const WorkerTimer = require("worker-timer");
const WebAudioScheduler = require('web-audio-scheduler');

interface IScheduledTrack {
	time: number;
	sound: AudioBufferSourceNode;
}

let __ID = 0; //TODO: could generate a loop id by using its position in Looper.loops

class Loop {
	id: number;
	//source: AudioBufferSourceNode;
	activeBufferSources: AudioBufferSourceNode[] = []
	buffer: AudioBuffer;
	output: GainNode;
	isPlaying: boolean;
	context: AudioContext;
	playCount: number = 0;
	maxPlayCount: number = 30;
	startOffset: number = 0;
	disposed: boolean = false;

	constructor(context) {
		this.isPlaying = false;
		this.context = context;
		this.output = this.context.createGain();
		//this.source.connect(this.output);
		this.buffer = null;
		this.id = __ID;
		__ID++;
	}

	play(time: number = this.context.currentTime){
		if (!this.disposed){
			console.log('start loop', this.id, 'at time',this.context.currentTime,'. Currently playing?', this.isPlaying)

			// Audiobuffer sources get created and deleted each time
			let source: AudioBufferSourceNode = this.context.createBufferSource();
			source.buffer = this.buffer;
			source.start(this.context.currentTime, this.startOffset);
			source.connect(this.output)
			//this.activeBufferSources.push(source);
			this.activeBufferSources[0] = source;
			this.isPlaying = true;
			this.playCount++;
		}
	}

	stop(time: number = this.context.currentTime) {
		if (this.disposed) return;
		console.log('stop loop', this.id, 'at time: ', time);
		this.activeBufferSources.forEach((src: AudioBufferSourceNode) => {
			src.stop(time);
		})
		this.activeBufferSources = [];
		this.isPlaying = false;
	}
	//
	// Lower the volume of the loop over time and eventually remove it after maxLoopAmount amount
	updateVolume(){
		this.output.gain.value /= 1.1; //TODO: calculate this number based on this.maxPlayCount
		// if this output is barely audible remove loop
		if (this.playCount >= this.maxPlayCount){
			this.dispose();
		}
	}

	dispose() {
		this.stop();
		this.output.disconnect();
		this.activeBufferSources.forEach((src: AudioBufferSourceNode) => {
			src.disconnect();
		})
		this.activeBufferSources = [];
		this.output = null;
		this.buffer = null;
		this.isPlaying = null;
		this.disposed = true;
	}
}

class Looper {

	isRecording: boolean = false
	isPlaying: boolean = false;

	get isOverdubbing(): boolean {
		return this.loops.length > 1 && this.isRecording;
	}

	get hasRecordings(): boolean {
		return this.loops.length ? true : false;
	};

	bufferSize: number;
	context: AudioContext;
	processor: ScriptProcessorNode
	loops: Loop[] = []; //todo: refactor to array of loops?
	currentLoopId: number = null;
	maxLoopDuration: number = 30;
	scheduledTracks: IScheduledTrack[] = [];
	input: AudioNode;
	output: AudioNode;
	minDuration: number = 0.7;
	loopLength: number = this.maxLoopDuration;
	nextLoopStartTime: number;
	timer: number;
	sched; //TODO: type this


	constructor(input: AudioNode, output: AudioNode, bufferSize: number = 4096) {

		this.input = input;
		this.output = output;
		this.bufferSize = bufferSize
		this.context = this.input.context;
		// recorder
		this.processor = this.context.createScriptProcessor(this.bufferSize, 2, 2);

		// connection
		this.input.connect(this.processor);
		this.processor.connect(this.output);


		this.sched = new WebAudioScheduler({
			timerAPI: WorkerTimer,
			context: this.context
		});

		this.playLoops = this.playLoops.bind(this);
		this.metronome = this.metronome.bind(this);
		this.onaudioprocess = this.onaudioprocess.bind(this);

	}

	metronome(e) {
		this.sched.insert(e.playbackTime, this.playLoops, { duration: this.loopLength });
		this.sched.insert(e.playbackTime + this.loopLength - 0.025, this.metronome);
	}

	playLoops(e) {
		//const t0 = e.playbackTime;
		//const t1 = t0 + e.args.duration;
		//
		console.log('playloops called')
		for (let i in this.loops){
			if (this.loops[i].buffer !== null){
				this.loops[i].play();
				if (this.isOverdubbing){
					this.loops[i].updateVolume();
				}
			}
		}

		//this.sched.nextTick(t1, () => {
		//	//for (let i in this.loops){
		//	//	this.loops[i].stop();
		//	//}
		//});
	}

	stopLoops() {
		for (let i in this.loops) {
			if (this.loops[i].buffer !== null) {
				this.loops[i].stop();
			}
		}
	}

	// WHEN RECORD/PLAY IS PRESSED //action
	onRecordPress() {
		//TODO: instead of if else, make a switch statement to detect this.recordState
		//STOPPED STATE
		if (!this.isRecording && !this.isOverdubbing){
			this.reset();
			this.startRecording();
		}
		//FIRST RECORDING STATE
		else if (this.isRecording && !this.isOverdubbing){
			this.startOverdubbing();
		}
		//PLAYING BACK STATE
		else if (this.isPlaying && !this.isRecording) {
			console.log('start recording whilst playing');
			//this.startRecording();
		}
		//OVERDUBBING STATE
		else if (this.isOverdubbing) {
			this.stopRecording();
			this.stopPlaying();
		}
	}

	// play/stop button
	onPlaybackPress() {
		//// if playing, stop playing
		if (this.isPlaying && !this.isOverdubbing) {
			this.stopPlaying();
		}

		// if we're recording and we click play/stop, stop recording
		else if (this.isRecording && !this.isPlaying) {
			this.stopRecording();
			this.startPlaying();
		}

		else if (this.isRecording && this.isPlaying) {
			this.stopRecording();
		}
		//
		// if we're not playing and not recording but there are recordings *to* play start playing them
		else if (!this.isRecording && this.hasRecordings) {
			this.startPlaying();
		}
	}

	startRecording() {
		// add a new track and set current loop
		this.incrementLoop();
		this.isRecording = true;
		this.processor.onaudioprocess = this.onaudioprocess;
	}

	stopRecording() {
		this.setLoopLength(this.loops[0]);
		console.log(`stopped recording, we have ${this.loops.length} loops`, this.loops);
		this.isRecording = false;
		this.processor.onaudioprocess = null;
	}

	setLoopLength(loop: Loop){
		this.loopLength = loop.buffer.duration;
	}

	startOverdubbing() {
		this.setLoopLength(this.loops[0]);

		console.log(`startOverdubbing, the loop length is ${this.loopLength}`);
		this.startPlaying();
	}

	startPlaying() {
		//this.nextLoopStartTime = this.context.currentTime;
		// run scheduler
		this.connectLoopToOutput(this.loops[0]);
		this.sched.start(this.metronome);
		this.isPlaying = true;
	}

	stopPlaying() {
		// stop playing
		this.isPlaying = false;
		this.sched.stop(true);
		this.stopLoops();
	}


	// on audio process loop
	onaudioprocess(e) {
		// not recording -> exit
		if (!this.isRecording && !this.isOverdubbing) {
			return;
		}
		// current loop
		let newLoop = this.loops[this.currentLoopId];

		// update recording with new audio event information
		newLoop.buffer = this.appendBuffer(newLoop.buffer, e.inputBuffer);

		// Save the updated loop
		this.loops[this.currentLoopId] = newLoop;

		// start a new loop & connect old loop to output if the loop length reaches the maximum loopLength (minus buffer time)
		if (newLoop.buffer.duration > this.loopLength - 0.025) {
			this.connectLoopToOutput(this.loops[this.currentLoopId]);
			this.nextLoopStartTime = this.context.currentTime;
			this.incrementLoop();
			console.log(`new recorded buffer added, duration ${newLoop.buffer.duration}`, this.loops);
		}
	};

	connectLoopToOutput(loop: Loop){
		loop.output.connect(this.output);
	}

	newLoop() {
		this.loops.push(new Loop(this.context));
	}

	incrementLoop() {
		console.log(`${this.loops.length} loops recorded`);
		this.setCurrentLoopId(this.loops.length);
		this.newLoop();
	}

	setCurrentLoopId(id: number) {
		this.currentLoopId = id;
	}

	// scheduler is constantly called
	//scheduler() {
	//	// next note soon
	//	while (this.nextLoopStartTime < this.context.currentTime) {
	//
	//		console.log('in loop at ', this.context.currentTime, 'the next loop start time was: ', this.nextLoopStartTime);
	//
	//		// shedule play
	//		this.playLoop(this.loopLength);
	//		// next beat time
	//		this.nextLoopStartTime += this.loopLength;
	//	}
	//
	//	// runner...
	//	this.timer = setInterval(() => {
	//		this.scheduler();
	//	}, 25);
	//}


	reset() {
		this.loops = [];
		this.loopLength = this.maxLoopDuration;
		//this.nextLoopStartTime = null;
		//this.timer = null;
	}

	/**
	 * Joins to buffers together. If one buffer is empty, return the other.
	 * @param b1 {AudioBuffer}
	 * @param b2 {AudioBuffer}
	 * @returns {AudioBuffer}
	 */
	private appendBuffer(b1, b2): AudioBuffer {
		if (b1 === null && b2 !== null){
			return b2;
		} else if (b2 === null && b1 !== null) {
			return b1;
		}
		var nc = Math.min(b1.numberOfChannels, b2.numberOfChannels);
		var b3 = (b1.length + b2.length);
		var tmp = this.context.createBuffer(nc, b3, b1.sampleRate);
		// For number of channels
		for (var i = 0; i < nc; i++) {
			var channel = tmp.getChannelData(i);
			channel.set(b1.getChannelData(i), 0);
			channel.set(b2.getChannelData(i), b1.length);
		}

		return tmp;
	};
}

export default Looper;

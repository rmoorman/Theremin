export const WAVEFORMS: string[] = [
	'sine',
	'square',
	'triangle',
	'saw',
]

export const Defaults: any = {
	Title: 'Theremin',
	Waveform: 1,
	VoiceCount: 8,
	Envelope: {
		attack: 0.01,
		decay: 0.5,
		sustain: 0.5,
		release: 0.01,
	},
	SetPitchRampTime: 0.05,
	NoteGuideButton: false,
	Sliders: [
		{
			name: 'delay',
			value: 2,
			min: 0,
			max: 100,
			step: 0.1,
		},
		{
			name: 'feedback',
			value: 100,
			min: 0,
			max: 100,
			step: 0.1,
		},
		{
			name: 'scuzz',
			value: 50,
			min: 0,
			max: 100,
			step: 0.1,
		},
	]
}

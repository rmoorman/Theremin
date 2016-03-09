import {RecordStateType} from './AppTypings';
import {PlayerStateType} from './AppTypings';

export interface IGlobalState {
	Waveform?: IWaveform;
	Player?: IPlayer;
	Recorder?: IRecorder;
	Slider?: ISlider;
	Modal?: IModal;
}

export interface IWaveform {
	wave?: string;
}

export interface IPlayer {
	playerState?: PlayerStateType | string; //FIXME: weird typescript error without adding string type here
}

export interface IRecorder {
	recordState?: RecordStateType | string; //FIXME: weird typescript error without adding string type here
}

export interface ISlider {
	delay?: number;
	feedback?: number;
	scuzz?: number;
}

export interface IModal {
	isOpen?: boolean;
}
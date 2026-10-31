"use strict";

import "adaptive-extender/worker";
import { Any, Deferred, Descendant, Field, Model } from "adaptive-extender/worker";

//#region Command
export interface CommandDiscriminator extends InitializeCommandDiscriminator, GenerateCommandDiscriminator, TickCommandDiscriminator, CaptureCommandDiscriminator, PictureCommandDiscriminator, StallCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeCommand))
@Descendant(Deferred(_ => GenerateCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => CaptureCommand))
@Descendant(Deferred(_ => PictureCommand))
@Descendant(Deferred(_ => StallCommand))
export abstract class Command extends Model {
	constructor() {
		super();
		if (new.target === Command) throw new TypeError("Unable to create an instance of an abstract class");
	}
}
//#endregion
//#region Initialize command
export interface InitializeCommandDiscriminator {
	"InitializeCommand": InitializeCommand;
}

export interface InitializeCommandScheme extends CommandScheme {
	$type: keyof InitializeCommandDiscriminator;
	canvas: OffscreenCanvas;
	size: number;
	seed: number;
}

export class InitializeCommand extends Command {
	@Field(Any.ByReference(OffscreenCanvas))
	canvas: OffscreenCanvas;

	@Field(Number)
	size: number;

	@Field(Number)
	seed: number;

	constructor();
	constructor(canvas: OffscreenCanvas, size: number, seed: number);
	constructor(canvas?: OffscreenCanvas, size?: number, seed?: number) {
		if (canvas === undefined || size === undefined || seed === undefined) {
			super();
			return;
		}

		super();
		this.canvas = canvas;
		this.size = size;
		this.seed = seed;
	}
}
//#endregion
//#region Generate command
export interface GenerateCommandDiscriminator {
	"GenerateCommand": GenerateCommand;
}

export interface GenerateCommandScheme extends CommandScheme {
	$type: keyof GenerateCommandDiscriminator;
	seed: number;
}

export class GenerateCommand extends Command {
	@Field(Number)
	seed: number;

	constructor();
	constructor(seed: number);
	constructor(seed?: number) {
		if (seed === undefined) {
			super();
			return;
		}

		super();
		this.seed = seed;
	}
}
//#endregion
//#region Tick command
export interface TickCommandDiscriminator {
	"TickCommand": TickCommand;
}

export interface TickCommandScheme extends CommandScheme {
	$type: keyof TickCommandDiscriminator;
}

export class TickCommand extends Command {
}
//#endregion
//#region Capture command
export interface CaptureCommandDiscriminator {
	"CaptureCommand": CaptureCommand;
}

export interface CaptureCommandScheme extends CommandScheme {
	$type: keyof CaptureCommandDiscriminator;
	width: number;
	height: number;
}

export class CaptureCommand extends Command {
	@Field(Number)
	width: number;

	@Field(Number)
	height: number;

	constructor();
	constructor(width: number, height: number);
	constructor(width?: number, height?: number) {
		if (width === undefined || height === undefined) {
			super();
			return;
		}

		super();
		this.width = width;
		this.height = height;
	}
}
//#endregion
//#region Picture command
export interface PictureCommandDiscriminator {
	"PictureCommand": PictureCommand;
}

export interface PictureCommandScheme extends CommandScheme {
	$type: keyof PictureCommandDiscriminator;
	picture: Blob;
}

export class PictureCommand extends Command {
	@Field(Any.ByReference(Blob))
	picture: Blob;

	constructor();
	constructor(picture: Blob);
	constructor(picture?: Blob) {
		if (picture === undefined) {
			super();
			return;
		}

		super();
		this.picture = picture;
	}
}
//#endregion
//#region Stall command
export interface StallCommandDiscriminator {
	"StallCommand": StallCommand;
}

export interface StallCommandScheme extends CommandScheme {
	$type: keyof StallCommandDiscriminator;
}

export class StallCommand extends Command {
}
//#endregion

"use strict";

import "adaptive-extender/worker";
import { Any, Deferred, Descendant, Enum, Field, Model } from "adaptive-extender/worker";
import { Kind } from "./elements.js";

//#region Command
export interface CommandDiscriminator extends InitializeCommandDiscriminator, GenerateCommandDiscriminator, TickCommandDiscriminator, DropCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeCommand))
@Descendant(Deferred(_ => GenerateCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => DropCommand))
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
//#region Drop command
export interface DropCommandDiscriminator {
	"DropCommand": DropCommand;
}

export interface DropCommandScheme extends CommandScheme {
	$type: keyof DropCommandDiscriminator;
	kind: Kind;
	x: number;
	y: number;
}

export class DropCommand extends Command {
	@Field(Enum.Of(Kind))
	kind: Kind;

	@Field(Number)
	x: number;

	@Field(Number)
	y: number;

	constructor();
	constructor(kind: Kind, x: number, y: number);
	constructor(kind?: Kind, x?: number, y?: number) {
		if (kind === undefined || x === undefined || y === undefined) {
			super();
			return;
		}

		super();
		this.kind = kind;
		this.x = x;
		this.y = y;
	}
}
//#endregion

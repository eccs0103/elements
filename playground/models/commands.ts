"use strict";

import "adaptive-extender/worker";
import { Any, Deferred, Descendant, Field, Model } from "adaptive-extender/worker";
import { Element, type ElementScheme } from "./elements.js";
import { Ticket, Report } from "../../arena/models/protocol.js";

//#region Command
export interface CommandDiscriminator extends InitializeCommandDiscriminator, StartCommandDiscriminator, TickCommandDiscriminator, DropCommandDiscriminator, PreviewCommandDiscriminator, ResizeCommandDiscriminator, StatusCommandDiscriminator, FinishCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeCommand))
@Descendant(Deferred(_ => StartCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => DropCommand))
@Descendant(Deferred(_ => PreviewCommand))
@Descendant(Deferred(_ => ResizeCommand))
@Descendant(Deferred(_ => StatusCommand))
@Descendant(Deferred(_ => FinishCommand))
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
}

export class InitializeCommand extends Command {
	@Field(Any.ByReference(OffscreenCanvas))
	canvas: OffscreenCanvas;

	constructor();
	constructor(canvas: OffscreenCanvas);
	constructor(canvas?: OffscreenCanvas) {
		if (canvas === undefined) {
			super();
			return;
		}

		super();
		this.canvas = canvas;
	}
}
//#endregion
//#region Start command
export interface StartCommandDiscriminator {
	"StartCommand": StartCommand;
}

export interface StartCommandScheme extends CommandScheme {
	$type: keyof StartCommandDiscriminator;
	ticket: Ticket;
}

export class StartCommand extends Command {
	@Field(Ticket)
	ticket: Ticket;

	constructor();
	constructor(ticket: Ticket);
	constructor(ticket?: Ticket) {
		if (ticket === undefined) {
			super();
			return;
		}

		super();
		this.ticket = ticket;
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
	slot: number;
	x: number;
	y: number;
}

export class DropCommand extends Command {
	@Field(Number)
	slot: number;

	@Field(Number)
	x: number;

	@Field(Number)
	y: number;

	constructor();
	constructor(slot: number, x: number, y: number);
	constructor(slot?: number, x?: number, y?: number) {
		if (slot === undefined || x === undefined || y === undefined) {
			super();
			return;
		}

		super();
		this.slot = slot;
		this.x = x;
		this.y = y;
	}
}
//#endregion
//#region Preview command
export interface PreviewCommandDiscriminator {
	"PreviewCommand": PreviewCommand;
}

export interface PreviewCommandScheme extends CommandScheme {
	$type: keyof PreviewCommandDiscriminator;
	active: boolean;
}

export class PreviewCommand extends Command {
	@Field(Boolean)
	active: boolean;

	constructor();
	constructor(active: boolean);
	constructor(active?: boolean) {
		if (active === undefined) {
			super();
			return;
		}

		super();
		this.active = active;
	}
}
//#endregion
//#region Resize command
export interface ResizeCommandDiscriminator {
	"ResizeCommand": ResizeCommand;
}

export interface ResizeCommandScheme extends CommandScheme {
	$type: keyof ResizeCommandDiscriminator;
	width: number;
	height: number;
}

export class ResizeCommand extends Command {
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
//#region Status command
export interface StatusCommandDiscriminator {
	"StatusCommand": StatusCommand;
}

export interface StatusCommandScheme extends CommandScheme {
	$type: keyof StatusCommandDiscriminator;
	cards: ElementScheme[];
	charge: number;
}

export class StatusCommand extends Command {
	@Field(Array.Of(Element))
	cards: Element[];

	@Field(Number)
	charge: number;

	constructor();
	constructor(cards: Element[], charge: number);
	constructor(cards?: Element[], charge?: number) {
		if (cards === undefined || charge === undefined) {
			super();
			return;
		}

		super();
		this.cards = cards;
		this.charge = charge;
	}
}
//#endregion
//#region Finish command
export interface FinishCommandDiscriminator {
	"FinishCommand": FinishCommand;
}

export interface FinishCommandScheme extends CommandScheme {
	$type: keyof FinishCommandDiscriminator;
	report: Report;
}

export class FinishCommand extends Command {
	@Field(Report)
	report: Report;

	constructor();
	constructor(report: Report);
	constructor(report?: Report) {
		if (report === undefined) {
			super();
			return;
		}

		super();
		this.report = report;
	}
}
//#endregion

"use strict";

import "adaptive-extender/worker";
import { Any, Deferred, Descendant, Field, Model, Nullable } from "adaptive-extender/worker";
import { Element, type ElementScheme } from "./elements.js";
import { Ticket, Report, Verdict, type TicketScheme, type ReportScheme, type VerdictScheme } from "../../arena/models/protocol.js";

//#region Command
export interface CommandDiscriminator extends InitializeCommandDiscriminator, StartCommandDiscriminator, TickCommandDiscriminator, DropCommandDiscriminator, PreviewCommandDiscriminator, InspectCommandDiscriminator, ResizeCommandDiscriminator, StatusCommandDiscriminator, FinishCommandDiscriminator {
}

export interface CommandScheme {
	$type: keyof CommandDiscriminator;
}

@Descendant(Deferred(_ => InitializeCommand))
@Descendant(Deferred(_ => StartCommand))
@Descendant(Deferred(_ => TickCommand))
@Descendant(Deferred(_ => DropCommand))
@Descendant(Deferred(_ => PreviewCommand))
@Descendant(Deferred(_ => InspectCommand))
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
	ticket: TicketScheme;
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
//#region Inspect command
export interface InspectCommandDiscriminator {
	"InspectCommand": InspectCommand;
}

export interface InspectCommandScheme extends CommandScheme {
	$type: keyof InspectCommandDiscriminator;
	cell: number | null;
}

export class InspectCommand extends Command {
	@Field(Nullable.Of(Number))
	cell: number | null;

	constructor();
	constructor(cell: number | null);
	constructor(cell?: number | null) {
		if (cell === undefined) {
			super();
			return;
		}

		super();
		this.cell = cell;
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
	inspected: ElementScheme | null;
	holder: number | null;
	tick: number;
	tally: VerdictScheme;
}

export class StatusCommand extends Command {
	@Field(Array.Of(Element))
	cards: Element[];

	@Field(Number)
	charge: number;

	@Field(Nullable.Of(Element))
	inspected: Element | null;

	@Field(Nullable.Of(Number))
	holder: number | null;

	@Field(Number)
	tick: number;

	@Field(Verdict)
	tally: Verdict;

	constructor();
	constructor(cards: Element[], charge: number, inspected: Element | null, holder: number | null, tick: number, tally: Verdict);
	constructor(cards?: Element[], charge?: number, inspected?: Element | null, holder?: number | null, tick?: number, tally?: Verdict) {
		if (cards === undefined || charge === undefined || inspected === undefined || holder === undefined || tick === undefined || tally === undefined) {
			super();
			return;
		}

		super();
		this.cards = cards;
		this.charge = charge;
		this.inspected = inspected;
		this.holder = holder;
		this.tick = tick;
		this.tally = tally;
	}
}
//#endregion
//#region Finish command
export interface FinishCommandDiscriminator {
	"FinishCommand": FinishCommand;
}

export interface FinishCommandScheme extends CommandScheme {
	$type: keyof FinishCommandDiscriminator;
	report: ReportScheme;
	verdict: VerdictScheme;
}

export class FinishCommand extends Command {
	@Field(Report)
	report: Report;

	@Field(Verdict)
	verdict: Verdict;

	constructor();
	constructor(report: Report, verdict: Verdict);
	constructor(report?: Report, verdict?: Verdict) {
		if (report === undefined || verdict === undefined) {
			super();
			return;
		}

		super();
		this.report = report;
		this.verdict = verdict;
	}
}
//#endregion

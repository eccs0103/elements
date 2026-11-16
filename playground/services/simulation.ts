"use strict";

import "adaptive-extender/web";
import { StaticEngine, URI } from "adaptive-extender/web";
import { type Element } from "../models/elements.js";
import { Command, InitializeCommand, StartCommand, BeginCommand, TickCommand, DropCommand, PreviewCommand, InspectCommand, ResizeCommand, StatusCommand, FinishCommand } from "../models/commands.js";
import { type Ticket, type Report, type Verdict } from "../../arena/models/protocol.js";

const { baseURI } = document;
const { round } = Math;

//#region Simulation
export interface SimulationEventMap {
	"update": Event;
	"launch": Event;
	"finish": Event;
	"failure": ErrorEvent;
}

export interface SimulationListener<K extends keyof SimulationEventMap> {
	(this: Simulation, event: SimulationEventMap[K]): void;
}

export class Simulation extends EventTarget {
	#worker: Worker = new Worker(new URI("./controllers/simulation-worker.js", baseURI).href, { type: "module" });
	#engine: StaticEngine = new StaticEngine({ launch: false });
	#ticket: Ticket | null = null;
	#cards: readonly Element[] = [];
	#charge: number = 0;
	#inspected: Element | null = null;
	#holder: number | null = null;
	#tick: number = 0;
	#tally: Verdict | null = null;
	#report: Report | null = null;
	#verdict: Verdict | null = null;
	#drops: DropCommand[] = [];
	#launching: boolean = false;

	constructor(canvas: HTMLCanvasElement, catalog: URI) {
		super();
		const engine = this.#engine;
		const worker = this.#worker;
		engine.addEventListener("trigger", event => worker.postMessage(Command.export(new TickCommand())));
		worker.addEventListener("message", this.#onMessage.bind(this));
		worker.addEventListener("error", this.#onError.bind(this));
		const offscreen = canvas.transferControlToOffscreen();
		worker.postMessage(Command.export(new InitializeCommand(offscreen, catalog)), [offscreen]);
		new ResizeObserver(entries => this.#resize(canvas)).observe(canvas);
		this.#resize(canvas);
	}

	get ticket(): Ticket | null { return this.#ticket; }
	get cards(): readonly Element[] { return this.#cards; }
	get charge(): number { return this.#charge; }
	get inspected(): Element | null { return this.#inspected; }
	get holder(): number | null { return this.#holder; }
	get report(): Report | null { return this.#report; }
	get verdict(): Verdict | null { return this.#verdict; }
	get tick(): number { return this.#tick; }
	get tally(): Verdict | null { return this.#tally; }

	show(ticket: Ticket): void {
		const engine = this.#engine;
		engine.launched = false;
		engine.limit = ticket.rules.rate;
		this.#launching = false;
		this.#drops.splice(0);
		this.#post(ticket);
	}

	launch(): void {
		if (this.#engine.launched || this.#launching || this.#verdict !== null) return;
		this.#launching = true;
		this.dispatchEvent(new Event("launch"));
	}

	start(ticket: Ticket): void {
		const engine = this.#engine;
		const worker = this.#worker;
		if (ticket.id !== this.#ticket?.id) this.#post(ticket);
		worker.postMessage(Command.export(new BeginCommand()));
		this.#launching = false;
		engine.limit = ticket.rules.rate;
		engine.launched = true;
		for (const drop of this.#drops.splice(0)) {
			worker.postMessage(Command.export(drop));
		}
	}

	drop(slot: number, x: number, y: number): void {
		const drop = new DropCommand(slot, x, y);
		if (!this.#engine.launched) {
			this.#drops.push(drop);
			return;
		}
		this.#worker.postMessage(Command.export(drop));
	}

	preview(active: boolean): void {
		this.#worker.postMessage(Command.export(new PreviewCommand(active)));
	}

	inspect(cell: number | null): void {
		this.#worker.postMessage(Command.export(new InspectCommand(cell)));
	}

	#post(ticket: Ticket): void {
		this.#ticket = ticket;
		this.#report = null;
		this.#verdict = null;
		this.#worker.postMessage(Command.export(new StartCommand(ticket)));
	}

	#resize(canvas: HTMLCanvasElement): void {
		const ratio = devicePixelRatio;
		const width = round(canvas.clientWidth * ratio);
		const height = round(canvas.clientHeight * ratio);
		if (width === 0 || height === 0) return;
		this.#worker.postMessage(Command.export(new ResizeCommand(width, height)));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof StatusCommand) {
			const { cards, charge, inspected, holder, tick, tally } = command;
			this.#cards = cards;
			this.#charge = charge;
			this.#inspected = inspected;
			this.#holder = holder;
			this.#tick = tick;
			this.#tally = tally;
			this.dispatchEvent(new Event("update"));
			return;
		}

		if (command instanceof FinishCommand) {
			this.#report = command.report;
			this.#verdict = command.verdict;
			this.#engine.launched = false;
			this.dispatchEvent(new Event("finish"));
			return;
		}
	}

	#onError(event: ErrorEvent): void {
		this.#engine.launched = false;
		this.dispatchEvent(new ErrorEvent("failure", { message: event.message }));
	}

	addEventListener<K extends keyof SimulationEventMap>(type: K, listener: SimulationListener<K>, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof SimulationEventMap>(type: K, listener: SimulationListener<K>, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		super.removeEventListener(type, listener, options);
	}
}
//#endregion

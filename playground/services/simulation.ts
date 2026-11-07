"use strict";

import "adaptive-extender/web";
import { StaticEngine, URI } from "adaptive-extender/web";
import { type Element } from "../models/elements.js";
import { Command, InitializeCommand, StartCommand, TickCommand, DropCommand, PreviewCommand, ResizeCommand, StatusCommand, FinishCommand } from "../models/commands.js";
import { type Ticket, type Report } from "../../arena/models/protocol.js";

const { baseURI } = document;
const { round } = Math;

//#region Simulation
export interface SimulationEventMap {
	"update": Event;
	"finish": Event;
}

export class Simulation extends EventTarget {
	#worker: Worker = new Worker(new URI("./controllers/simulation-worker.js", baseURI).href, { type: "module" });
	#engine: StaticEngine = new StaticEngine({ launch: false });
	#ticket: Ticket | null = null;
	#cards: readonly Element[] = [];
	#charge: number = 0;
	#report: Report | null = null;

	constructor(canvas: HTMLCanvasElement) {
		super();
		const engine = this.#engine;
		const worker = this.#worker;
		engine.addEventListener("trigger", event => worker.postMessage(Command.export(new TickCommand())));
		worker.addEventListener("message", this.#onMessage.bind(this));
		const offscreen = canvas.transferControlToOffscreen();
		worker.postMessage(Command.export(new InitializeCommand(offscreen)), [offscreen]);
		new ResizeObserver(entries => this.#resize(canvas)).observe(canvas);
		this.#resize(canvas);
	}

	get ticket(): Ticket | null { return this.#ticket; }
	get cards(): readonly Element[] { return this.#cards; }
	get charge(): number { return this.#charge; }
	get report(): Report | null { return this.#report; }

	launch(): void {
		this.#engine.launched = true;
	}

	start(ticket: Ticket): void {
		this.#ticket = ticket;
		this.#report = null;
		this.#engine.limit = ticket.rules.rate;
		this.#worker.postMessage(Command.export(new StartCommand(ticket)));
	}

	drop(slot: number, x: number, y: number): void {
		this.#worker.postMessage(Command.export(new DropCommand(slot, x, y)));
	}

	preview(active: boolean): void {
		this.#worker.postMessage(Command.export(new PreviewCommand(active)));
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
			const { cards, charge } = command;
			this.#cards = cards;
			this.#charge = charge;
			this.dispatchEvent(new Event("update"));
			return;
		}

		if (command instanceof FinishCommand) {
			this.#report = command.report;
			this.#engine.launched = false;
			this.dispatchEvent(new Event("finish"));
			return;
		}
	}

	addEventListener<K extends keyof SimulationEventMap>(type: K, listener: (this: Simulation, event: SimulationEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		super.addEventListener(type, listener, options);
	}

	removeEventListener<K extends keyof SimulationEventMap>(type: K, listener: (this: Simulation, event: SimulationEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
	removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		super.removeEventListener(type, listener, options);
	}
}
//#endregion

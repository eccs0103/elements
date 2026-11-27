"use strict";

import "adaptive-extender/web";
import { Nullable, StaticEngine, URI } from "adaptive-extender/web";
import { Command, InitializeCommand, StartCommand, BeginCommand, TickCommand, DropCommand, PreviewCommand, InspectCommand, ResizeCommand, StatusCommand, FinishCommand, TrainCommand, LessonCommand } from "../models/commands.js";
import { Verdict, type Ticket } from "../../arena/models/protocol.js";
import { Match } from "./match.js";
import { Course, Progress, type Lesson } from "./course.js";
import { type Rules } from "../models/rules.js";

const { baseURI } = document;
const { round } = Math;

//#region Simulation
export interface SimulationEventMap {
	"update": Event;
	"launch": Event;
	"finish": Event;
	"lesson": Event;
	"failure": ErrorEvent;
}

export interface SimulationListener<K extends keyof SimulationEventMap> {
	(this: Simulation, event: SimulationEventMap[K]): void;
}

export class Simulation extends EventTarget {
	#worker: Worker = new Worker(new URI("./controllers/simulation-worker.js", baseURI).href, { type: "module" });
	#engine: StaticEngine = new StaticEngine({ launch: false });
	#ticket: Ticket | null = null;
	#lesson: Lesson | null = null;
	#progress: Progress = Progress.running;
	#status: StatusCommand = new StatusCommand([], 0, null, null, 0, new Verdict(new Array<number>(Match.count).fill(0)));
	#finish: FinishCommand | null = null;
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
	get status(): StatusCommand { return this.#status; }
	get finish(): FinishCommand | null { return this.#finish; }
	get lesson(): Lesson | null { return this.#lesson; }
	get progress(): Progress { return this.#progress; }
	get rules(): Rules | null { return this.#lesson?.rules ?? Nullable.map(this.#ticket, ticket => ticket.rules); }

	show(ticket: Ticket): void {
		const engine = this.#engine;
		engine.launched = false;
		// Not simplified: start sets the limit again, but the engine's timer already runs at this limit while it waits; dropping it would shift the first tick.
		engine.limit = ticket.rules.rate;
		this.#launching = false;
		this.#drops.splice(0);
		this.#post(ticket);
	}

	train(lesson: Lesson): void {
		const engine = this.#engine;
		this.#ticket = null;
		this.#finish = null;
		this.#lesson = lesson;
		this.#progress = Progress.running;
		this.#launching = false;
		this.#drops.splice(0);
		this.#worker.postMessage(Command.export(new TrainCommand(Course.index(lesson))));
		engine.limit = lesson.rules.rate;
		engine.launched = true;
		this.dispatchEvent(new Event("lesson"));
	}

	launch(): void {
		if (this.#engine.launched || this.#launching || this.#finish !== null) return;
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
		this.#lesson = null;
		this.#finish = null;
		this.#worker.postMessage(Command.export(new StartCommand(ticket)));
	}

	#resize(canvas: HTMLCanvasElement): void {
		const ratio = devicePixelRatio;
		const width = round(canvas.clientWidth * ratio);
		const height = round(canvas.clientHeight * ratio);
		if (width === 0 || height === 0) return;
		this.#worker.postMessage(Command.export(new ResizeCommand(width, height)));
	}

	// Not simplified: the last branch keeps its return, so every branch has one shape (owner ruling).
	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof StatusCommand) {
			this.#status = command;
			this.dispatchEvent(new Event("update"));
			return;
		}

		if (command instanceof LessonCommand) {
			this.#progress = command.progress;
			this.dispatchEvent(new Event("lesson"));
			return;
		}

		if (command instanceof FinishCommand) {
			this.#finish = command;
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

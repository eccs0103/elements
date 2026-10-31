"use strict";

import "adaptive-extender/web";
import { Random, StaticEngine } from "adaptive-extender/web";
import { Command, InitializeCommand, GenerateCommand, TickCommand, CaptureCommand, PictureCommand, StallCommand } from "../models/commands.js";

const { baseURI } = document;
const { trunc } = Math;

//#region Simulation
export interface SimulationEventMap {
	"stall": Event;
}

export class Simulation extends EventTarget {
	static #seeds: number = 0x7FFFFFFF;
	#worker: Worker = new Worker(new URL("./controllers/simulation-worker.js", baseURI), { type: "module" });
	#engine: StaticEngine = new StaticEngine({ launch: false });
	#canvas: HTMLCanvasElement;
	#playing: boolean = false;
	#picture: PromiseWithResolvers<Blob> | null = null;

	constructor(canvas: HTMLCanvasElement, size: number, speed: number) {
		super();
		this.#canvas = canvas;
		const engine = this.#engine;
		const worker = this.#worker;
		engine.limit = speed;
		engine.addEventListener("trigger", event => worker.postMessage(Command.export(new TickCommand())));
		worker.addEventListener("message", this.#onMessage.bind(this));
		document.addEventListener("visibilitychange", event => this.#sync());
		const offscreen = canvas.transferControlToOffscreen();
		worker.postMessage(Command.export(new InitializeCommand(offscreen, size, Simulation.#seed())), [offscreen]);
	}

	static #seed(): number {
		return Random.global.integer(Simulation.#seeds);
	}

	get launched(): boolean { return this.#playing; }
	set launched(value: boolean) {
		this.#playing = value;
		this.#sync();
	}

	get rate(): number { return this.#engine.fps; }
	get speed(): number { return this.#engine.limit; }

	generate(): void {
		this.#worker.postMessage(Command.export(new GenerateCommand(Simulation.#seed())));
	}

	async capture(): Promise<Blob> {
		const picture = this.#picture ??= Promise.withResolvers<Blob>();
		const { width, height } = this.#canvas.getBoundingClientRect();
		this.#worker.postMessage(Command.export(new CaptureCommand(trunc(width), trunc(height))));
		return await picture.promise;
	}

	#sync(): void {
		this.#engine.launched = this.#playing && !document.hidden;
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof PictureCommand) {
			const picture = this.#picture;
			if (picture === null) return;
			this.#picture = null;
			picture.resolve(command.picture);
			return;
		}

		if (command instanceof StallCommand) {
			this.dispatchEvent(new Event("stall"));
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

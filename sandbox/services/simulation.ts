"use strict";

import "adaptive-extender/web";
import { Random, StaticEngine } from "adaptive-extender/web";
import { type Kind } from "../models/elements.js";
import { Command, InitializeCommand, GenerateCommand, TickCommand, DropCommand } from "../models/commands.js";

const { baseURI } = document;

//#region Simulation
export class Simulation {
	static #rate: number = 90;
	static #seeds: number = 0x7FFFFFFF;
	#worker: Worker = new Worker(new URL("./controllers/simulation-worker.js", baseURI), { type: "module" });
	#engine: StaticEngine = new StaticEngine({ launch: false });
	#playing: boolean = false;

	constructor(canvas: HTMLCanvasElement) {
		const engine = this.#engine;
		const worker = this.#worker;
		engine.limit = Simulation.#rate;
		engine.addEventListener("trigger", event => worker.postMessage(Command.export(new TickCommand())));
		document.addEventListener("visibilitychange", event => this.#sync());
		const offscreen = canvas.transferControlToOffscreen();
		worker.postMessage(Command.export(new InitializeCommand(offscreen, Simulation.#seed())), [offscreen]);
	}

	static #seed(): number {
		return Random.global.integer(Simulation.#seeds);
	}

	get launched(): boolean { return this.#playing; }
	set launched(value: boolean) {
		this.#playing = value;
		this.#sync();
	}

	generate(): void {
		this.#worker.postMessage(Command.export(new GenerateCommand(Simulation.#seed())));
	}

	drop(kind: Kind, x: number, y: number): void {
		this.#worker.postMessage(Command.export(new DropCommand(kind, x, y)));
	}

	#sync(): void {
		this.#engine.launched = this.#playing && !document.hidden;
	}
}
//#endregion

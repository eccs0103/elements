"use strict";

import "adaptive-extender/web";
import { Nullable } from "adaptive-extender/web";
import { type Simulation } from "../services/simulation.js";
import { type Cell, type Crosshair } from "./crosshair.js";

//#region Probe
export class Probe extends EventTarget {
	#board: HTMLCanvasElement;
	#crosshair: Crosshair;
	#simulation: Simulation;
	#pointer: number | null = null;
	#target: Cell | null = null;
	#pressed: boolean = false;
	#bottom: boolean = false;

	constructor(board: HTMLCanvasElement, crosshair: Crosshair, simulation: Simulation) {
		super();
		this.#board = board;
		this.#crosshair = crosshair;
		this.#simulation = simulation;
	}

	get pressed(): boolean { return this.#pressed; }
	get bottom(): boolean { return this.#bottom; }

	listen(signal: AbortSignal): void {
		const board = this.#board;
		const release = this.#release.bind(this);
		board.addEventListener("pointerdown", this.#press.bind(this), { signal });
		board.addEventListener("pointermove", this.#track.bind(this), { signal });
		board.addEventListener("pointerup", release, { signal });
		board.addEventListener("pointercancel", release, { signal });
	}

	#track(event: PointerEvent): void {
		if (event.pointerId !== this.#pointer) return;
		const crosshair = this.#crosshair;
		const { size } = crosshair;
		if (size === null) return;
		const cell = crosshair.aim(event);
		if (cell === this.#target) return;
		this.#target = cell;
		this.#bottom = cell !== null && cell.y < size / 2;
		this.dispatchEvent(new Event("change"));
		this.#simulation.inspect(Nullable.map(cell, cell => cell.index(size)));
	}

	#press(event: PointerEvent): void {
		if (this.#pointer !== null) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const { pointerId } = event;
		this.#board.setPointerCapture(pointerId);
		this.#pointer = pointerId;
		this.#pressed = true;
		this.dispatchEvent(new Event("change"));
		this.#track(event);
	}

	#release(event: PointerEvent): void {
		if (event.pointerId !== this.#pointer) return;
		this.#pointer = null;
		this.#target = null;
		this.#crosshair.hide();
		this.#pressed = false;
		this.dispatchEvent(new Event("change"));
		this.#simulation.inspect(null);
	}
}
//#endregion

"use strict";

import "adaptive-extender/web";
import { Nullable } from "adaptive-extender/web";
import { type Simulation } from "../services/simulation.js";

const { trunc } = Math;

//#region Cell
export class Cell {
	#x: number;
	#y: number;

	constructor(x: number, y: number) {
		this.#x = x;
		this.#y = y;
	}

	get x(): number { return this.#x; }
	get y(): number { return this.#y; }

	is(other: Cell): boolean {
		return this.#x === other.#x && this.#y === other.#y;
	}

	index(size: number): number {
		return this.#y * size + this.#x;
	}
}
//#endregion
//#region Crosshair
export class Crosshair {
	#container: HTMLElement;
	#board: HTMLCanvasElement;
	#simulation: Simulation;
	#aimed: Cell | null = null;

	constructor(container: HTMLElement, board: HTMLCanvasElement, simulation: Simulation) {
		this.#container = container;
		this.#board = board;
		this.#simulation = simulation;
	}

	get size(): number | null {
		return Nullable.map(this.#simulation.ticket, ticket => ticket.rules.size);
	}

	cell(event: PointerEvent): Cell | null {
		const size = this.size;
		if (size === null) return null;
		return this.#locate(event, size);
	}

	aim(event: PointerEvent): Cell | null {
		const size = this.size;
		const cell = size === null ? null : this.#locate(event, size);
		if (size === null || cell === null) {
			this.hide();
			return null;
		}
		const board = this.#board;
		board.classList.toggle("aimed", document.elementFromPoint(event.clientX, event.clientY) === board);
		const aimed = this.#aimed;
		if (aimed !== null && aimed.is(cell)) return aimed;
		this.#aimed = cell;
		const container = this.#container;
		const { style } = container;
		style.setProperty("--size", `${size}`);
		style.setProperty("--column", `${cell.x}`);
		style.setProperty("--row", `${cell.y}`);
		container.hidden = false;
		return cell;
	}

	hide(): void {
		this.#aimed = null;
		this.#board.classList.remove("aimed");
		this.#container.hidden = true;
	}

	#locate(event: PointerEvent, size: number): Cell | null {
		const { left, top, width, height } = this.#board.getBoundingClientRect();
		const x = trunc((event.clientX - left) / width * size);
		const y = trunc((event.clientY - top) / height * size);
		if (x < 0 || x >= size || y < 0 || y >= size) return null;
		return new Cell(x, y);
	}
}
//#endregion

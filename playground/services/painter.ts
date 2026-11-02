"use strict";

import "adaptive-extender/worker";
import { Color } from "adaptive-extender/worker";
import { Catalog } from "../models/elements.js";
import { type Board } from "./board.js";

const { round, max } = Math;

//#region Painter
export class Painter {
	static #stride: number = max(...Catalog.elements.map(element => element.budget)) + 1;
	static #palette: Uint32Array = Painter.#tabulate();
	static #lines: readonly string[] = [Color.newWhite.toString(), Color.newBlack.toString()];
	static #shade: string = Color.fromRGB(0, 0, 0, 0.5).toString();
	#context: OffscreenCanvasRenderingContext2D;
	#cells: OffscreenCanvasRenderingContext2D;
	#image: ImageData;
	#pixels: Uint32Array;

	constructor(canvas: OffscreenCanvas) {
		this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");
		this.#prepare(1);
	}

	static #tabulate(): Uint32Array {
		const stride = Painter.#stride;
		const { elements } = Catalog;
		const palette = new Uint32Array(elements.length * stride);
		for (let kind = 0; kind < elements.length; kind++) {
			const element = elements[kind];
			for (let budget = 0; budget <= element.budget; budget++) {
				const { red, green, blue } = element.tint(budget);
				palette[kind * stride + budget] = ((255 << 24) | (round(blue) << 16) | (round(green) << 8) | round(red)) >>> 0;
			}
		}
		return palette;
	}

	resize(width: number, height: number): void {
		const { canvas } = this.#context;
		canvas.width = width;
		canvas.height = height;
	}

	paint(board: Board, zone: Uint8Array | null): void {
		const { size } = board;
		if (this.#cells.canvas.width !== size) this.#prepare(size);
		this.#fill(board);
		const context = this.#context;
		const { width, height } = context.canvas;
		context.imageSmoothingEnabled = false;
		context.drawImage(this.#cells.canvas, 0, 0, width, height);
		if (zone !== null) this.#dim(zone, size);
		this.#outline(board);
	}

	#dim(zone: Uint8Array, size: number): void {
		const context = this.#context;
		const scale = context.canvas.width / size;
		context.beginPath();
		for (let y = 0; y < size; y++) {
			let start = -1;
			for (let x = 0; x <= size; x++) {
				const stops = x === size || zone[y * size + x] === 1;
				if (!stops && start < 0) start = x;
				if (!stops || start < 0) continue;
				context.rect(start * scale, y * scale, (x - start) * scale, scale);
				start = -1;
			}
		}
		context.fillStyle = Painter.#shade;
		context.fill();
	}

	#prepare(size: number): void {
		this.#cells = ReferenceError.suppress(new OffscreenCanvas(size, size).getContext("2d"), "Failed to acquire 2D rendering context");
		const image = this.#image = new ImageData(size, size);
		this.#pixels = new Uint32Array(image.data.buffer);
	}

	#fill(board: Board): void {
		const stride = Painter.#stride;
		const palette = Painter.#palette;
		const pixels = this.#pixels;
		const { kinds, tints } = board;
		for (let cell = 0; cell < pixels.length; cell++) {
			pixels[cell] = palette[kinds[cell] * stride + tints[cell]];
		}
		this.#cells.putImageData(this.#image, 0, 0);
	}

	#outline(board: Board): void {
		const lines = Painter.#lines;
		const context = this.#context;
		const { size, owners } = board;
		const scale = context.canvas.width / size;
		const width = max(1, scale / 4);
		const inset = width / 2;
		context.lineWidth = width;
		context.lineCap = "square";
		for (let owner = 1; owner <= lines.length; owner++) {
			context.beginPath();
			for (let cell = 0; cell < owners.length; cell++) {
				if (owners[cell] !== owner) continue;
				const x = cell % size;
				const y = (cell - x) / size;
				const left = x * scale + inset;
				const right = (x + 1) * scale - inset;
				const top = y * scale + inset;
				const bottom = (y + 1) * scale - inset;
				if (y > 0 && owners[cell - size] !== owner) this.#edge(left, top, right, top);
				if (y < size - 1 && owners[cell + size] !== owner) this.#edge(left, bottom, right, bottom);
				if (x > 0 && owners[cell - 1] !== owner) this.#edge(left, top, left, bottom);
				if (x < size - 1 && owners[cell + 1] !== owner) this.#edge(right, top, right, bottom);
			}
			context.strokeStyle = lines[owner - 1];
			context.stroke();
		}
	}

	#edge(x: number, y: number, x2: number, y2: number): void {
		const context = this.#context;
		context.moveTo(x, y);
		context.lineTo(x2, y2);
	}
}
//#endregion

"use strict";

import "adaptive-extender/worker";
import { Catalog } from "../models/elements.js";
import { type Board } from "./board.js";

const { round, max } = Math;

//#region Painter
export class Painter {
	static #stride: number = Catalog.elements.reduce((stride, element) => max(stride, element.budget + 1), 1);
	static #palette: Uint32Array = Painter.#tabulate();
	#context: OffscreenCanvasRenderingContext2D;
	#image: ImageData;
	#pixels: Uint32Array;

	constructor(canvas: OffscreenCanvas) {
		this.#context = ReferenceError.suppress(canvas.getContext("2d"), "Failed to acquire 2D rendering context");
		const image = this.#image = new ImageData(canvas.width, canvas.height);
		this.#pixels = new Uint32Array(image.data.buffer);
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

	paint(board: Board): void {
		const stride = Painter.#stride;
		const palette = Painter.#palette;
		const pixels = this.#pixels;
		const { kinds, budgets } = board;
		for (let cell = 0; cell < pixels.length; cell++) {
			pixels[cell] = palette[kinds[cell] * stride + budgets[cell]];
		}
		this.#context.putImageData(this.#image, 0, 0);
	}
}
//#endregion

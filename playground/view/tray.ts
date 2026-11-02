"use strict";

import "adaptive-extender/web";
import { Catalog } from "../models/elements.js";
import { type Simulation } from "../services/simulation.js";

const { body } = document;
const { trunc } = Math;

//#region Tray
export class Tray {
	#container: HTMLElement;
	#board: HTMLCanvasElement;
	#simulation: Simulation;
	#spans: HTMLSpanElement[] = [];
	#ghost: HTMLSpanElement;
	#slot: number | null = null;

	constructor(container: HTMLElement, board: HTMLCanvasElement, simulation: Simulation) {
		this.#container = container;
		this.#board = board;
		this.#simulation = simulation;
		const spanGhost = this.#ghost = document.createElement("span");
		spanGhost.classList.add("ghost", "rounded");
		spanGhost.hidden = true;
		body.appendChild(spanGhost);
	}

	render(): void {
		const { cards, charge } = this.#simulation;
		const container = this.#container;
		const spans = this.#spans;
		while (spans.length < cards.length) {
			spans.push(this.#create(spans.length));
		}
		while (spans.length > cards.length) {
			spans.pop()?.remove();
		}
		for (let slot = 0; slot < cards.length; slot++) {
			const { name, color } = Catalog.at(cards[slot]);
			const spanCard = spans[slot];
			spanCard.title = name;
			spanCard.style.setProperty("--color", color.toString());
		}
		container.style.setProperty("--charge", `${charge}`);
	}

	#create(slot: number): HTMLSpanElement {
		const spanCard = document.createElement("span");
		spanCard.classList.add("card", "rounded");
		spanCard.addEventListener("pointerdown", event => this.#grab(event, spanCard, slot));
		spanCard.addEventListener("pointermove", event => this.#follow(event));
		spanCard.addEventListener("pointerup", event => this.#release(event));
		spanCard.addEventListener("pointercancel", event => this.#cancel());
		this.#container.appendChild(spanCard);
		return spanCard;
	}

	#grab(event: PointerEvent, spanCard: HTMLSpanElement, slot: number): void {
		const simulation = this.#simulation;
		if (simulation.charge < 1) return;
		spanCard.setPointerCapture(event.pointerId);
		this.#slot = slot;
		const spanGhost = this.#ghost;
		spanGhost.style.setProperty("--color", spanCard.style.getPropertyValue("--color"));
		spanGhost.hidden = false;
		simulation.preview(true);
		this.#follow(event);
	}

	#follow(event: PointerEvent): void {
		if (this.#slot === null) return;
		const { style } = this.#ghost;
		style.setProperty("--x", `${event.clientX}px`);
		style.setProperty("--y", `${event.clientY}px`);
	}

	#release(event: PointerEvent): void {
		const slot = this.#slot;
		if (slot === null) return;
		this.#cancel();
		const simulation = this.#simulation;
		const { ticket } = simulation;
		if (ticket === null) return;
		const { size } = ticket.rules;
		const { left, top, width, height } = this.#board.getBoundingClientRect();
		const x = trunc((event.clientX - left) / width * size);
		const y = trunc((event.clientY - top) / height * size);
		if (x < 0 || x >= size || y < 0 || y >= size) return;
		simulation.drop(slot, x, y);
	}

	#cancel(): void {
		if (this.#slot === null) return;
		this.#slot = null;
		this.#ghost.hidden = true;
		this.#simulation.preview(false);
	}
}
//#endregion

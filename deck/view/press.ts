"use strict";

import "adaptive-extender/web";
import { type Element } from "../../playground/models/elements.js";

const { hypot } = Math;

//#region Press
export class Press {
	static #threshold: number = 6;
	static #delay: number = 200;
	static #buzz: number = 10;
	#button: HTMLButtonElement;
	#slot: number | null;
	#element: Element;
	#pointer: number;
	#mouse: boolean;
	#x: number;
	#y: number;
	#timer: number | null = null;
	#held: boolean = false;
	#dragging: boolean = false;

	constructor(button: HTMLButtonElement, event: PointerEvent, slot: number | null, element: Element) {
		this.#button = button;
		this.#slot = slot;
		this.#element = element;
		this.#pointer = event.pointerId;
		this.#mouse = event.pointerType === "mouse";
		this.#x = event.clientX;
		this.#y = event.clientY;
	}

	get slot(): number | null { return this.#slot; }
	get element(): Element { return this.#element; }
	get mouse(): boolean { return this.#mouse; }
	get held(): boolean { return this.#held; }
	get dragging(): boolean { return this.#dragging; }
	get captured(): boolean { return this.#held || this.#dragging; }

	get classes(): string {
		let classes = " pressing";
		if (this.#held) classes += " held";
		if (this.#dragging) classes += " lifted";
		return classes;
	}

	is(slot: number | null, element: Element): boolean {
		return this.#slot === slot && this.#element.is(element);
	}

	strays(event: PointerEvent): boolean {
		return hypot(event.clientX - this.#x, event.clientY - this.#y) > Press.#threshold;
	}

	arm(callback: VoidFunction): void {
		this.disarm();
		this.#timer = window.setTimeout(this.#hold.bind(this, callback), Press.#delay);
	}

	disarm(): void {
		const timer = this.#timer;
		if (timer !== null) clearTimeout(timer);
		this.#timer = null;
	}

	drag(): void {
		this.disarm();
		this.#dragging = true;
		this.#button.setPointerCapture(this.#pointer);
	}

	#hold(callback: VoidFunction): void {
		this.#timer = null;
		this.#held = true;
		this.#button.setPointerCapture(this.#pointer);
		if ("vibrate" in navigator) navigator.vibrate(Press.#buzz);
		callback();
	}
}
//#endregion
//#region Slots
export class Slots {
	#buttons: (HTMLButtonElement | null)[] = [];

	set(slot: number, button: HTMLButtonElement | null): void {
		this.#buttons[slot] = button;
	}

	find(x: number, y: number): number | null {
		const buttonSlot = document.elementFromPoint(x, y)?.closest("button.slot");
		if (!(buttonSlot instanceof HTMLButtonElement)) return null;
		const slot = this.#buttons.indexOf(buttonSlot);
		return slot < 0 ? null : slot;
	}
}
//#endregion

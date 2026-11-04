"use strict";

import "adaptive-extender/web";
import { type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { type DeckService } from "../../playground/services/deck-service.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";

const { hypot } = Math;

//#region Drag
class Drag {
	#button: HTMLButtonElement;
	#pointer: number;
	#x: number;
	#y: number;
	#lifted: boolean = false;

	constructor(button: HTMLButtonElement, event: PointerEvent) {
		this.#button = button;
		this.#pointer = event.pointerId;
		this.#x = event.clientX;
		this.#y = event.clientY;
	}

	get button(): HTMLButtonElement { return this.#button; }
	get lifted(): boolean { return this.#lifted; }
	get x(): number { return this.#x; }
	get y(): number { return this.#y; }

	strays(event: PointerEvent, threshold: number): boolean {
		return hypot(event.clientX - this.#x, event.clientY - this.#y) > threshold;
	}

	lift(): void {
		const button = this.#button;
		this.#lifted = true;
		button.setPointerCapture(this.#pointer);
		button.classList.add("lifted");
	}

	settle(): void {
		this.#button.classList.remove("lifted");
	}
}
//#endregion
//#region Deck builder
export class DeckBuilder {
	static #threshold: number = 6;
	static #delay: number = 250;
	#service: DeckService;
	#spanCount: HTMLSpanElement;
	#spanGhost: HTMLSpanElement;
	#slots: HTMLButtonElement[] = [];
	#cards: Map<HTMLButtonElement, Element> = new Map();
	#drag: Drag | null = null;
	#timer: number | null = null;
	#swallow: boolean = false;

	constructor(service: DeckService, container: HTMLElement, templateSlot: HTMLTemplateElement, templateCard: HTMLTemplateElement, spanGhost: HTMLSpanElement) {
		this.#service = service;
		this.#spanGhost = spanGhost;
		this.#spanCount = container.getElement(HTMLSpanElement, "span#count");
		const olSlots = container.getElement(HTMLOListElement, "ol#slots");
		const ulCollection = container.getElement(HTMLUListElement, "ul#collection");
		const { capacity } = service.content;
		const { hand } = new Rules();
		container.getElement(HTMLSpanElement, "span#hint").textContent = `Drag elements into the deck, or tap one to add or remove it. In a match your hand holds ${hand} of these ${capacity} at random.`;
		const slots = this.#slots;
		for (let slot = 0; slot < capacity; slot++) {
			const fragment = document.importNode(templateSlot.content, true);
			const buttonSlot = fragment.getElement(HTMLButtonElement, "button.slot");
			buttonSlot.addEventListener("click", event => void this.#guard(this.#tap(slot)));
			this.#bind(buttonSlot);
			slots.push(buttonSlot);
			olSlots.appendChild(fragment);
		}
		for (const element of PeriodicTable.placeable) {
			ulCollection.appendChild(this.#render(element, templateCard));
		}
		this.#refresh();
	}

	#render(element: Element, templateCard: HTMLTemplateElement): DocumentFragment {
		const fragment = document.importNode(templateCard.content, true);
		const buttonCard = fragment.getElement(HTMLButtonElement, "button.card");
		buttonCard.style.setProperty("--color", element.color.toString());
		buttonCard.getElement(HTMLSpanElement, "span.name").textContent = element.name;
		buttonCard.getElement(HTMLSpanElement, "span.reactions").textContent = element.reactions.map(reaction => reaction.name).join(", ");
		buttonCard.addEventListener("click", event => void this.#guard(this.#pick(element)));
		this.#bind(buttonCard);
		this.#cards.set(buttonCard, element);
		return fragment;
	}

	#bind(button: HTMLButtonElement): void {
		button.addEventListener("pointerdown", event => this.#press(event, button));
		button.addEventListener("pointermove", event => this.#follow(event));
		button.addEventListener("pointerup", event => void this.#guard(this.#release(event)));
		button.addEventListener("pointercancel", event => this.#cancel());
		button.addEventListener("touchmove", event => this.#hold(event), { passive: false });
	}

	#refresh(): void {
		const { content } = this.#service;
		const { elements, capacity } = content;
		const slots = this.#slots;
		this.#spanCount.textContent = `${elements.length} / ${capacity}`;
		for (let slot = 0; slot < slots.length; slot++) {
			const buttonSlot = slots[slot];
			if (slot < elements.length) this.#fill(buttonSlot, elements[slot]);
			else this.#empty(buttonSlot);
		}
		for (const [buttonCard, element] of this.#cards) {
			const chosen = content.holds(element);
			buttonCard.classList.toggle("chosen", chosen);
			buttonCard.title = chosen ? `Remove ${element.name} from the deck` : `Add ${element.name} to the deck`;
		}
	}

	#fill(buttonSlot: HTMLButtonElement, element: Element): void {
		const { name } = element;
		buttonSlot.classList.remove("empty");
		buttonSlot.title = `${name}: tap to remove, drag to move`;
		buttonSlot.style.setProperty("--color", element.color.toString());
		buttonSlot.getElement(HTMLSpanElement, "span.name").textContent = name;
	}

	#empty(buttonSlot: HTMLButtonElement): void {
		buttonSlot.classList.add("empty");
		buttonSlot.title = "Empty slot: drop an element here";
		buttonSlot.style.removeProperty("--color");
		buttonSlot.getElement(HTMLSpanElement, "span.name").textContent = "Empty";
	}

	#movable(button: HTMLButtonElement): boolean {
		const { content } = this.#service;
		const element = this.#cards.get(button);
		if (element !== undefined) return !content.holds(element);
		return this.#slots.indexOf(button) < content.elements.length;
	}

	#press(event: PointerEvent, button: HTMLButtonElement): void {
		this.#swallow = false;
		this.#cancel();
		if (!event.isPrimary || !this.#movable(button)) return;
		const drag = this.#drag = new Drag(button, event);
		if (event.pointerType === "mouse") return;
		this.#timer = setTimeout(this.#lift.bind(this, drag), DeckBuilder.#delay);
	}

	#lift(drag: Drag): void {
		const spanGhost = this.#spanGhost;
		this.#timer = null;
		drag.lift();
		spanGhost.style.setProperty("--color", drag.button.style.getPropertyValue("--color"));
		spanGhost.hidden = false;
		this.#aim(drag, drag.x, drag.y);
	}

	#follow(event: PointerEvent): void {
		const drag = this.#drag;
		if (drag === null) return;
		if (!drag.lifted) {
			if (!drag.strays(event, DeckBuilder.#threshold)) return;
			if (event.pointerType !== "mouse") return this.#cancel();
			this.#lift(drag);
		}
		this.#aim(drag, event.clientX, event.clientY);
	}

	#hold(event: TouchEvent): void {
		if (this.#drag?.lifted !== true) return;
		event.preventDefault();
	}

	#aim(drag: Drag, x: number, y: number): void {
		const { style, classList } = this.#spanGhost;
		const target = this.#find(x, y);
		style.setProperty("--x", `${x}px`);
		style.setProperty("--y", `${y}px`);
		classList.toggle("leaving", target === null && !this.#cards.has(drag.button));
		this.#mark(target);
	}

	#find(x: number, y: number): number | null {
		const buttonSlot = document.elementFromPoint(x, y)?.closest("button.slot");
		if (!(buttonSlot instanceof HTMLButtonElement)) return null;
		return this.#slots.indexOf(buttonSlot);
	}

	#mark(target: number | null): void {
		const slots = this.#slots;
		for (let slot = 0; slot < slots.length; slot++) {
			slots[slot].classList.toggle("target", slot === target);
		}
	}

	async #release(event: PointerEvent): Promise<void> {
		const drag = this.#drag;
		this.#cancel();
		if (drag === null || !drag.lifted) return;
		this.#swallow = true;
		this.#drop(drag.button, this.#find(event.clientX, event.clientY));
		await this.#commit();
	}

	#cancel(): void {
		const timer = this.#timer;
		if (timer !== null) clearTimeout(timer);
		this.#timer = null;
		this.#drag?.settle();
		this.#drag = null;
		this.#spanGhost.hidden = true;
		this.#mark(null);
	}

	#drop(button: HTMLButtonElement, target: number | null): void {
		const { content } = this.#service;
		const element = this.#cards.get(button);
		if (element !== undefined) {
			if (target !== null) content.place(target, element);
			return;
		}
		const slot = this.#slots.indexOf(button);
		if (target === null) return content.remove(slot);
		content.move(slot, target);
	}

	#consume(): boolean {
		const swallow = this.#swallow;
		this.#swallow = false;
		return swallow;
	}

	async #tap(slot: number): Promise<void> {
		if (this.#consume()) return;
		const { content } = this.#service;
		if (slot >= content.elements.length) return;
		content.remove(slot);
		await this.#commit();
	}

	async #pick(element: Element): Promise<void> {
		if (this.#consume()) return;
		const { content } = this.#service;
		if (content.holds(element)) content.remove(element);
		else if (content.full) throw new RangeError(`The deck is full. Drag ${element.name} onto a slot to swap it in.`);
		else content.add(element);
		await this.#commit();
	}

	async #commit(): Promise<void> {
		this.#refresh();
		await this.#service.save();
	}

	async #guard(task: Promise<void>): Promise<void> {
		try {
			await task;
		} catch (reason) {
			this.#refresh();
			window.alert(Error.from(reason).message);
		}
	}
}
//#endregion

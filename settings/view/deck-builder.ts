"use strict";

import "adaptive-extender/web";
import { Phase, type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { type DeckService } from "../../playground/services/deck-service.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { type ElementDialog } from "./element-dialog.js";

const { hypot } = Math;

//#region Press
class Press {
	#button: HTMLButtonElement;
	#pointer: number;
	#mouse: boolean;
	#x: number;
	#y: number;
	#held: boolean = false;
	#dragging: boolean = false;

	constructor(button: HTMLButtonElement, event: PointerEvent) {
		this.#button = button;
		this.#pointer = event.pointerId;
		this.#mouse = event.pointerType === "mouse";
		this.#x = event.clientX;
		this.#y = event.clientY;
		button.classList.add("pressing");
	}

	get button(): HTMLButtonElement { return this.#button; }
	get mouse(): boolean { return this.#mouse; }
	get held(): boolean { return this.#held; }
	get dragging(): boolean { return this.#dragging; }
	get captured(): boolean { return this.#held || this.#dragging; }
	get x(): number { return this.#x; }
	get y(): number { return this.#y; }

	strays(event: PointerEvent, threshold: number): boolean {
		return hypot(event.clientX - this.#x, event.clientY - this.#y) > threshold;
	}

	hold(): void {
		const button = this.#button;
		this.#held = true;
		button.setPointerCapture(this.#pointer);
		button.classList.add("held");
	}

	drag(): void {
		const button = this.#button;
		this.#dragging = true;
		button.setPointerCapture(this.#pointer);
		button.classList.add("lifted");
	}

	settle(): void {
		this.#button.classList.remove("pressing", "held", "lifted");
	}
}
//#endregion
//#region Deck builder
export class DeckBuilder {
	static #threshold: number = 6;
	static #delay: number = 200;
	static #buzz: number = 10;
	#service: DeckService;
	#details: ElementDialog;
	#spanCount: HTMLSpanElement;
	#spanGhost: HTMLSpanElement;
	#slots: HTMLButtonElement[] = [];
	#cards: Map<HTMLButtonElement, Element> = new Map();
	#press: Press | null = null;
	#timer: number | null = null;
	#swallow: boolean = false;

	constructor(service: DeckService, details: ElementDialog, container: HTMLElement, templateSlot: HTMLTemplateElement, templateCard: HTMLTemplateElement, spanGhost: HTMLSpanElement) {
		this.#service = service;
		this.#details = details;
		this.#spanGhost = spanGhost;
		this.#spanCount = container.getElement(HTMLSpanElement, "span#count");
		const olSlots = container.getElement(HTMLOListElement, "ol#slots");
		const divCollection = container.getElement(HTMLDivElement, "div#collection");
		const { capacity } = service.content;
		const { hand } = new Rules();
		container.getElement(HTMLSpanElement, "span#hint").textContent = `Tap to add or remove, drag to place, hold for details. In a match your hand holds ${hand} of these ${capacity} at random.`;
		const slots = this.#slots;
		for (let slot = 0; slot < capacity; slot++) {
			const fragment = document.importNode(templateSlot.content, true);
			const buttonSlot = fragment.getElement(HTMLButtonElement, "button.slot");
			buttonSlot.addEventListener("click", event => void this.#guard(this.#tap(slot)));
			this.#bind(buttonSlot);
			slots.push(buttonSlot);
			olSlots.appendChild(fragment);
		}
		for (const phase of Object.values(Phase)) {
			const elements = PeriodicTable.placeable.filter(element => element.phase === phase);
			if (elements.length === 0) continue;
			divCollection.appendChild(this.#group(phase, elements, templateCard));
		}
		details.dialog.addEventListener("close", event => this.#refresh());
		document.addEventListener("keydown", event => this.#escape(event));
		this.#refresh();
	}

	#group(phase: Phase, elements: readonly Element[], templateCard: HTMLTemplateElement): HTMLElement {
		const sectionGroup = document.createElement("section");
		sectionGroup.classList.add("group", "flex", "column");
		const h4Phase = document.createElement("h4");
		h4Phase.classList.add("phase", "flex");
		const spanTotal = document.createElement("span");
		spanTotal.classList.add("description");
		spanTotal.textContent = String(elements.length);
		h4Phase.append(document.createTextNode(phase), spanTotal);
		const ulCards = document.createElement("ul");
		ulCards.classList.add("cards", "with-gap");
		for (const element of elements) {
			ulCards.appendChild(this.#render(element, templateCard));
		}
		sectionGroup.append(h4Phase, ulCards);
		return sectionGroup;
	}

	#render(element: Element, templateCard: HTMLTemplateElement): DocumentFragment {
		const fragment = document.importNode(templateCard.content, true);
		const buttonCard = fragment.getElement(HTMLButtonElement, "button.card");
		this.#paint(buttonCard, element);
		buttonCard.getElement(HTMLSpanElement, "span.name").textContent = element.name;
		buttonCard.getElement(HTMLSpanElement, "span.icon.flammable").hidden = !element.flammable;
		buttonCard.getElement(HTMLSpanElement, "span.icon.conductive").hidden = !element.conductive;
		buttonCard.addEventListener("click", event => void this.#guard(this.#pick(element)));
		this.#bind(buttonCard);
		this.#cards.set(buttonCard, element);
		return fragment;
	}

	#paint(button: HTMLButtonElement, element: Element): void {
		const { style } = button;
		style.setProperty("--color", element.color.toString());
		style.setProperty("--faded", element.tint(0).toString());
	}

	#bind(button: HTMLButtonElement): void {
		button.addEventListener("pointerdown", event => this.#begin(event, button));
		button.addEventListener("pointermove", event => this.#follow(event));
		button.addEventListener("pointerup", event => void this.#guard(this.#release(event)));
		button.addEventListener("pointercancel", event => this.#cancel());
		button.addEventListener("touchmove", event => this.#hold(event), { passive: false });
		button.addEventListener("contextmenu", event => this.#menu(event, button));
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
			buttonCard.title = chosen ? `${element.name}: tap to remove, hold for details` : `${element.name}: tap to add, hold for details`;
		}
	}

	#fill(buttonSlot: HTMLButtonElement, element: Element): void {
		const { name } = element;
		buttonSlot.classList.remove("empty");
		buttonSlot.title = `${name}: tap to remove, drag to move, hold for details`;
		this.#paint(buttonSlot, element);
		buttonSlot.getElement(HTMLSpanElement, "span.name").textContent = name;
	}

	#empty(buttonSlot: HTMLButtonElement): void {
		const { style } = buttonSlot;
		buttonSlot.classList.add("empty");
		buttonSlot.title = "Empty slot: drop an element here";
		style.removeProperty("--color");
		style.removeProperty("--faded");
		buttonSlot.getElement(HTMLSpanElement, "span.name").textContent = "Empty";
	}

	#element(button: HTMLButtonElement): Element | null {
		const element = this.#cards.get(button);
		if (element !== undefined) return element;
		return this.#service.content.elements.at(this.#slots.indexOf(button)) ?? null;
	}

	#movable(button: HTMLButtonElement): boolean {
		const { content } = this.#service;
		const element = this.#cards.get(button);
		if (element !== undefined) return !content.holds(element);
		return this.#slots.indexOf(button) < content.elements.length;
	}

	#begin(event: PointerEvent, button: HTMLButtonElement): void {
		this.#swallow = false;
		this.#cancel();
		if (!event.isPrimary || event.button !== 0 || this.#element(button) === null) return;
		const press = this.#press = new Press(button, event);
		this.#timer = setTimeout(this.#reach.bind(this, press), DeckBuilder.#delay);
	}

	#reach(press: Press): void {
		this.#timer = null;
		press.hold();
		if ("vibrate" in navigator) navigator.vibrate(DeckBuilder.#buzz);
	}

	#follow(event: PointerEvent): void {
		const press = this.#press;
		if (press === null) return;
		if (press.dragging) return this.#aim(press, event.clientX, event.clientY);
		if (!press.strays(event, DeckBuilder.#threshold)) return;
		if (!press.held && !press.mouse) return this.#cancel();
		if (!this.#movable(press.button)) {
			this.#swallow = press.held;
			return this.#cancel();
		}
		this.#lift(press);
		this.#aim(press, event.clientX, event.clientY);
	}

	#lift(press: Press): void {
		const spanGhost = this.#spanGhost;
		const timer = this.#timer;
		if (timer !== null) clearTimeout(timer);
		this.#timer = null;
		press.drag();
		spanGhost.style.setProperty("--color", press.button.style.getPropertyValue("--color"));
		spanGhost.hidden = false;
	}

	#hold(event: TouchEvent): void {
		if (this.#press?.captured !== true) return;
		event.preventDefault();
	}

	#menu(event: MouseEvent, button: HTMLButtonElement): void {
		event.preventDefault();
		if (this.#press !== null) return;
		this.#inspect(button);
	}

	#escape(event: KeyboardEvent): void {
		if (event.key !== "Escape" || this.#press === null) return;
		this.#swallow = true;
		this.#cancel();
	}

	#inspect(button: HTMLButtonElement): void {
		const element = this.#element(button);
		if (element === null) return;
		this.#details.show(element);
	}

	#aim(press: Press, x: number, y: number): void {
		const { style, classList } = this.#spanGhost;
		const target = this.#find(x, y);
		style.setProperty("--x", `${x}px`);
		style.setProperty("--y", `${y}px`);
		classList.toggle("leaving", target === null && !this.#cards.has(press.button));
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
		const press = this.#press;
		this.#cancel();
		if (press === null) return;
		if (press.dragging) {
			this.#swallow = true;
			this.#drop(press.button, this.#find(event.clientX, event.clientY));
			return await this.#commit();
		}
		if (!press.held) return;
		this.#swallow = true;
		this.#inspect(press.button);
	}

	#cancel(): void {
		const timer = this.#timer;
		if (timer !== null) clearTimeout(timer);
		this.#timer = null;
		this.#press?.settle();
		this.#press = null;
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

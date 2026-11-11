"use strict";

import "adaptive-extender/web";
import { Law, Reach, type Element, type ElementType, type Reaction } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { Board } from "../../playground/services/board.js";
import { Painter } from "../../playground/services/painter.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { type DeckService } from "../../playground/services/deck-service.js";

const { trunc } = Math;

//#region Demo
class Demo {
	static #size: number = 21;
	static #resolution: number = 504;
	static #seconds: number = 5;
	static #seed: number = 1;
	#painter: Painter;
	#rate: number;
	#board: Board;
	#element: Element | null = null;
	#partner: Element | null = null;
	#start: number = 0;
	#ticks: number = 0;
	#frame: number | null = null;

	constructor(canvas: HTMLCanvasElement, rate: number) {
		const painter = this.#painter = new Painter(canvas.transferControlToOffscreen());
		const resolution = Demo.#resolution;
		painter.resize(resolution, resolution);
		this.#rate = rate;
		this.#board = new Board(Demo.#size, Demo.#seed);
	}

	play(element: Element, partner: Element | null): void {
		this.#element = element;
		this.#partner = partner;
		this.#reset(element, performance.now());
		if (this.#frame === null) this.#request();
	}

	stop(): void {
		const frame = this.#frame;
		if (frame !== null) cancelAnimationFrame(frame);
		this.#frame = null;
	}

	#request(): void {
		this.#frame = requestAnimationFrame(this.#advance.bind(this));
	}

	#reset(element: Element, time: number): void {
		const size = Demo.#size;
		const partner = this.#partner;
		const board = this.#board = new Board(size, Demo.#seed);
		this.#start = time;
		this.#ticks = 0;
		const middle = trunc(size / 2);
		if (partner === null) return board.drop(element, middle, middle, 1);
		for (let y = 1; y < size; y += 3) {
			for (let x = 1; x < middle - 1; x += 3) {
				board.drop(partner, x, y, 2);
			}
		}
		for (let y = 4; y < size; y += 6) {
			board.drop(element, middle, y, 1);
		}
	}

	#advance(time: number): void {
		const element = this.#element;
		if (element === null) return;
		let start = this.#start;
		if (time - start > Demo.#seconds * 1000) {
			this.#reset(element, time);
			start = time;
		}
		const board = this.#board;
		const due = trunc((time - start) / 1000 * this.#rate);
		let ticks = this.#ticks;
		while (ticks < due) {
			board.step();
			ticks++;
		}
		this.#ticks = ticks;
		this.#painter.paint(board, null);
		this.#request();
	}
}
//#endregion
//#region Element dialog
export class ElementDialog {
	static #crowd: number = 8;
	#service: DeckService;
	#rate: number;
	#dialog: HTMLDialogElement;
	#templateRow: HTMLTemplateElement;
	#templateChip: HTMLTemplateElement;
	#buttonBack: HTMLButtonElement;
	#spanTile: HTMLSpanElement;
	#h2Name: HTMLHeadingElement;
	#spanPhase: HTMLSpanElement;
	#ulTraits: HTMLUListElement;
	#spanVersus: HTMLSpanElement;
	#buttonOpen: HTMLButtonElement;
	#olActs: HTMLOListElement;
	#olThreats: HTMLOListElement;
	#buttonToggle: HTMLButtonElement;
	#demo: Demo;
	#history: Element[] = [];
	#partner: Element | null = null;

	constructor(service: DeckService, dialog: HTMLDialogElement, templateRow: HTMLTemplateElement, templateChip: HTMLTemplateElement) {
		this.#service = service;
		this.#rate = new Rules().rate;
		this.#dialog = dialog;
		this.#templateRow = templateRow;
		this.#templateChip = templateChip;
		const buttonBack = this.#buttonBack = dialog.getElement(HTMLButtonElement, "button.back");
		this.#spanTile = dialog.getElement(HTMLSpanElement, "header span.tile");
		this.#h2Name = dialog.getElement(HTMLHeadingElement, "h2.name");
		this.#spanPhase = dialog.getElement(HTMLSpanElement, "span.phase");
		this.#ulTraits = dialog.getElement(HTMLUListElement, "ul.traits");
		this.#spanVersus = dialog.getElement(HTMLSpanElement, "span.versus");
		const buttonOpen = this.#buttonOpen = dialog.getElement(HTMLButtonElement, "button.open");
		this.#olActs = dialog.getElement(HTMLOListElement, "section.acts ol.rows");
		this.#olThreats = dialog.getElement(HTMLOListElement, "section.threats ol.rows");
		const buttonToggle = this.#buttonToggle = dialog.getElement(HTMLButtonElement, "button.toggle");
		this.#demo = new Demo(dialog.getElement(HTMLCanvasElement, "canvas.board"), this.#rate);
		buttonBack.addEventListener("click", event => this.#back());
		buttonOpen.addEventListener("click", event => this.#follow());
		buttonToggle.addEventListener("click", event => void this.#toggle());
		dialog.getElement(HTMLButtonElement, "button.close").addEventListener("click", event => dialog.close());
		dialog.addEventListener("click", event => this.#dismiss(event));
		dialog.addEventListener("close", event => this.#demo.stop());
	}

	get dialog(): HTMLDialogElement { return this.#dialog; }

	show(element: Element): void {
		const history = this.#history;
		history.length = 0;
		history.push(element);
		this.#render();
		this.#dialog.showModal();
	}

	#current(): Element {
		const history = this.#history;
		const element = history.at(-1);
		if (element === undefined) throw new ReferenceError("No element is shown");
		return element;
	}

	#render(): void {
		const element = this.#current();
		const { name } = element;
		this.#buttonBack.hidden = this.#history.length < 2;
		this.#paint(this.#spanTile, element);
		this.#h2Name.textContent = name;
		this.#spanPhase.textContent = element.phase;
		this.#traits(element);
		const acts = this.#acts(element);
		const threats = this.#threats(element);
		this.#offer(element);
		this.#dialog.scrollTop = 0;
		this.#watch(acts.find(other => !other.is(PeriodicTable.ground)) ?? threats.at(0) ?? null);
	}

	#paint(spanTile: HTMLSpanElement, element: Element): void {
		const { style } = spanTile;
		style.setProperty("--color", element.color.toString());
		style.setProperty("--faded", element.tint(0).toString());
	}

	#traits(element: Element): void {
		const ulTraits = this.#ulTraits;
		const { heat } = element;
		ulTraits.replaceChildren();
		const liHeat = this.#trait("heat", `Heat ${heat > 0 ? "+" : ""}${heat}`);
		const spanScale = document.createElement("span");
		spanScale.classList.add("scale", "flex", "alt-center");
		for (let step = -3; step <= 3; step++) {
			const spanDot = document.createElement("span");
			spanDot.classList.add("dot");
			spanDot.classList.toggle("on", step === heat);
			spanDot.style.setProperty("--step", String(step + 3));
			spanScale.appendChild(spanDot);
		}
		liHeat.appendChild(spanScale);
		ulTraits.appendChild(liHeat);
		if (element.flammable) ulTraits.appendChild(this.#trait("flammable", "Flammable"));
		if (element.conductive) ulTraits.appendChild(this.#trait("conductive", "Conducts"));
	}

	#trait(kind: string, text: string): HTMLLIElement {
		const liTrait = document.createElement("li");
		liTrait.classList.add("trait", "depth", "rounded", "flex", "alt-center", "with-gap", "small-gap", "with-padding", "small-padding", "font-smaller-3", kind);
		const spanIcon = document.createElement("span");
		spanIcon.classList.add("icon");
		liTrait.append(spanIcon, document.createTextNode(text));
		return liTrait;
	}

	#acts(element: Element): Element[] {
		const olActs = this.#olActs;
		const partners: Element[] = [];
		olActs.replaceChildren();
		for (const reaction of element.reactions) {
			const targets = PeriodicTable.elements.filter(other => reaction.reaches(element, other));
			partners.push(...targets);
			olActs.appendChild(this.#act(element, reaction, targets));
		}
		if (olActs.childElementCount === 0) olActs.appendChild(this.#empty("It does nothing by itself: it only holds its ground."));
		return partners;
	}

	#act(element: Element, reaction: Reaction, targets: readonly Element[]): HTMLLIElement {
		const { law, product, remains } = reaction;
		const liRow = this.#row(reaction);
		const pSentence = liRow.getElement(HTMLParagraphElement, "p.sentence");
		switch (law) {
		case Law.spread:
			this.#text(pSentence, reaction.reach === Reach.surrounding ? "Grows in all 8 directions into" : "Grows into");
			this.#chips(pSentence, targets);
			this.#text(pSentence, this.#reach(element));
			break;
		case Law.convert:
			this.#text(pSentence, "Turns");
			this.#chips(pSentence, targets);
			this.#text(pSentence, "into");
			this.#chips(pSentence, [this.#resolve(product)]);
			break;
		case Law.ignite:
			this.#text(pSentence, "Sets");
			this.#chips(pSentence, targets);
			this.#text(pSentence, "on fire, turning them into");
			this.#chips(pSentence, [this.#resolve(product)]);
			break;
		case Law.cool:
			this.#text(pSentence, "Turns");
			this.#chips(pSentence, targets);
			this.#text(pSentence, "into");
			this.#chips(pSentence, [this.#resolve(product)]);
			this.#text(pSentence, `${this.#uses(element)}, then becomes`);
			this.#chips(pSentence, [this.#resolve(remains)]);
			break;
		case Law.destroy:
			this.#text(pSentence, "Destroys");
			this.#chips(pSentence, targets);
			this.#text(pSentence, "into");
			this.#chips(pSentence, [this.#resolve(product)]);
			this.#text(pSentence, "and becomes");
			this.#chips(pSentence, [this.#resolve(remains)]);
			break;
		case Law.burnout:
			this.#text(pSentence, "Then becomes");
			this.#chips(pSentence, [this.#resolve(remains)]);
			break;
		default: throw new TypeError(`Invalid '${law}' law`);
		}
		return liRow;
	}

	#threats(element: Element): Element[] {
		const olThreats = this.#olThreats;
		const enemies: Element[] = [];
		olThreats.replaceChildren();
		for (const other of PeriodicTable.elements) {
			if (other.is(element)) continue;
			for (const reaction of other.reactions) {
				if (!reaction.reaches(other, element)) continue;
				if (!enemies.includes(other)) enemies.push(other);
				olThreats.appendChild(this.#threat(other, reaction));
			}
		}
		if (olThreats.childElementCount === 0) olThreats.appendChild(this.#empty("Nothing acts on it: only a drop can replace it."));
		return enemies;
	}

	#threat(other: Element, reaction: Reaction): HTMLLIElement {
		const { law, product, remains } = reaction;
		const liRow = this.#row(reaction);
		const pSentence = liRow.getElement(HTMLParagraphElement, "p.sentence");
		this.#chips(pSentence, [other]);
		switch (law) {
		case Law.spread:
			this.#text(pSentence, "grows over it");
			break;
		case Law.convert:
			this.#text(pSentence, "turns it into");
			this.#chips(pSentence, [this.#resolve(product)]);
			break;
		case Law.ignite:
			this.#text(pSentence, "sets it on fire, turning it into");
			this.#chips(pSentence, [this.#resolve(product)]);
			break;
		case Law.cool:
			this.#text(pSentence, "turns it into");
			this.#chips(pSentence, [this.#resolve(product)]);
			break;
		case Law.destroy:
			this.#text(pSentence, "destroys it into");
			this.#chips(pSentence, [this.#resolve(product)]);
			this.#text(pSentence, "and becomes");
			this.#chips(pSentence, [this.#resolve(remains)]);
			break;
		default: throw new TypeError(`Invalid '${law}' law`);
		}
		return liRow;
	}

	#row(reaction: Reaction): HTMLLIElement {
		const fragment = document.importNode(this.#templateRow.content, true);
		const liRow = fragment.getElement(HTMLLIElement, "li.row");
		const seconds = this.#seconds(reaction.interval);
		liRow.getElement(HTMLSpanElement, "span.when").textContent = `${reaction.name} · ${reaction.law === Law.burnout ? "after" : "every"} ${seconds} s`;
		liRow.getElement(HTMLSpanElement, "span.summary").textContent = reaction.description;
		return liRow;
	}

	#empty(text: string): HTMLLIElement {
		const liEmpty = document.createElement("li");
		liEmpty.classList.add("description");
		liEmpty.textContent = text;
		return liEmpty;
	}

	#text(pSentence: HTMLParagraphElement, text: string): void {
		const spanText = document.createElement("span");
		spanText.textContent = text;
		pSentence.appendChild(spanText);
	}

	#chips(pSentence: HTMLParagraphElement, elements: readonly Element[]): void {
		const crowded = elements.length > ElementDialog.#crowd;
		for (const element of elements) {
			pSentence.appendChild(this.#chip(element, crowded));
		}
	}

	#chip(element: Element, compact: boolean): HTMLButtonElement {
		const fragment = document.importNode(this.#templateChip.content, true);
		const buttonChip = fragment.getElement(HTMLButtonElement, "button.chip");
		const { name } = element;
		this.#paint(buttonChip.getElement(HTMLSpanElement, "span.tile"), element);
		buttonChip.getElement(HTMLSpanElement, "span.name").textContent = name;
		buttonChip.classList.toggle("compact", compact);
		buttonChip.title = `Watch ${name} here`;
		buttonChip.setAttribute("aria-label", `Watch ${name}`);
		buttonChip.addEventListener("click", event => this.#watch(element));
		return buttonChip;
	}

	#resolve(type: ElementType | null): Element {
		if (type === null) throw new ReferenceError("The reaction has no resulting element");
		return PeriodicTable.at(PeriodicTable.id(type));
	}

	#seconds(interval: number): string {
		return String(Number(((interval + 1) / this.#rate).toFixed(2)));
	}

	#reach(element: Element): string {
		const { budget } = element;
		if (budget === 0) return "without limit";
		return `up to ${budget - 1} cells away`;
	}

	#uses(element: Element): string {
		const { budget } = element;
		return `${budget + 1} times`;
	}

	#watch(partner: Element | null): void {
		const element = this.#current();
		const ground = partner !== null && partner.is(PeriodicTable.ground);
		const chosen = ground ? null : partner;
		const buttonOpen = this.#buttonOpen;
		this.#partner = chosen;
		this.#spanVersus.textContent = chosen === null ? `${element.name} alone on Dirt` : `${element.name} against ${chosen.name}`;
		buttonOpen.hidden = chosen === null || chosen.is(element);
		if (chosen !== null) buttonOpen.textContent = `Open ${chosen.name} ›`;
		this.#demo.play(element, chosen);
	}

	#follow(): void {
		const partner = this.#partner;
		if (partner === null) return;
		this.#history.push(partner);
		this.#render();
	}

	#back(): void {
		const history = this.#history;
		if (history.length < 2) return;
		history.pop();
		this.#render();
	}

	#dismiss(event: MouseEvent): void {
		const dialog = this.#dialog;
		if (event.target !== dialog) return;
		dialog.close();
	}

	#offer(element: Element): void {
		const { content } = this.#service;
		const buttonToggle = this.#buttonToggle;
		const chosen = content.holds(element);
		buttonToggle.disabled = !chosen && content.full;
		buttonToggle.classList.toggle("depth", chosen);
		buttonToggle.classList.toggle("highlight-background", !chosen);
		if (chosen) buttonToggle.textContent = "Remove from deck";
		else if (content.full) buttonToggle.textContent = "Deck is full: drag it onto a slot to swap";
		else buttonToggle.textContent = "Add to deck";
	}

	async #toggle(): Promise<void> {
		const element = this.#current();
		const service = this.#service;
		const { content } = service;
		try {
			if (content.holds(element)) content.remove(element);
			else content.add(element);
			await service.save();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
		this.#offer(element);
	}
}
//#endregion

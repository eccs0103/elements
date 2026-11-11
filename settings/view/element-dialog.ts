"use strict";

import "adaptive-extender/web";
import { type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { Board } from "../../playground/services/board.js";
import { Painter } from "../../playground/services/painter.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { type DeckService } from "../../playground/services/deck-service.js";
import { Sentence, type Phrase } from "../models/sentence.js";

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
		this.#reset(element, partner, performance.now());
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

	#reset(element: Element, partner: Element | null, time: number): void {
		const size = Demo.#size;
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
			this.#reset(element, this.#partner, time);
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
		this.#spanVersus = dialog.getElement(HTMLSpanElement, "span#versus");
		const buttonOpen = this.#buttonOpen = dialog.getElement(HTMLButtonElement, "button.open");
		this.#olActs = dialog.getElement(HTMLOListElement, "ol#acts");
		this.#olThreats = dialog.getElement(HTMLOListElement, "ol#threats");
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
		const rate = this.#rate;
		const acts = Sentence.acts(element, rate);
		const threats = Sentence.threats(element, rate);
		this.#list(this.#olActs, acts, "It does nothing by itself: it only holds its ground.");
		this.#list(this.#olThreats, threats, "Nothing acts on it: only a drop can replace it.");
		this.#offer(element);
		this.#dialog.scrollTop = 0;
		this.#watch(this.#suggest(acts, threats));
	}

	#suggest(acts: readonly Sentence[], threats: readonly Sentence[]): Element | null {
		for (const sentence of acts) {
			const target = sentence.subjects.find(other => !other.is(PeriodicTable.ground));
			if (target !== undefined) return target;
		}
		return threats.at(0)?.subjects.at(0) ?? null;
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

	#list(olRows: HTMLOListElement, sentences: readonly Sentence[], empty: string): void {
		olRows.replaceChildren();
		for (const sentence of sentences) {
			olRows.appendChild(this.#row(sentence));
		}
		if (sentences.length === 0) olRows.appendChild(this.#empty(empty));
	}

	#row(sentence: Sentence): HTMLLIElement {
		const fragment = document.importNode(this.#templateRow.content, true);
		const liRow = fragment.getElement(HTMLLIElement, "li.row");
		const pSentence = liRow.getElement(HTMLParagraphElement, "p");
		liRow.getElement(HTMLElement, "header").textContent = sentence.when;
		liRow.getElement(HTMLElement, "footer").textContent = sentence.summary;
		for (const phrase of sentence.phrases) {
			this.#phrase(pSentence, phrase);
		}
		return liRow;
	}

	#phrase(pSentence: HTMLParagraphElement, phrase: Phrase): void {
		const { text, compact } = phrase;
		if (text !== null) {
			const spanText = document.createElement("span");
			spanText.textContent = text;
			pSentence.appendChild(spanText);
		}
		for (const element of phrase.elements) {
			pSentence.appendChild(this.#chip(element, compact));
		}
	}

	#empty(text: string): HTMLLIElement {
		const liEmpty = document.createElement("li");
		liEmpty.classList.add("description");
		liEmpty.textContent = text;
		return liEmpty;
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

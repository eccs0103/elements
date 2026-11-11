"use strict";

import "adaptive-extender/web";
import { Nullable } from "adaptive-extender/web";
import { type Element } from "../models/elements.js";
import { type Simulation } from "../services/simulation.js";
import { type Ticket } from "../../arena/models/protocol.js";
import { Phrase, Sentence } from "../../settings/models/sentence.js";
import { type Cell, type Crosshair } from "./crosshair.js";

//#region Peek
export class Peek {
	#section: HTMLElement;
	#board: HTMLCanvasElement;
	#crosshair: Crosshair;
	#simulation: Simulation;
	#templateLine: HTMLTemplateElement;
	#templateChip: HTMLTemplateElement;
	#spanTile: HTMLSpanElement;
	#h3Title: HTMLHeadingElement;
	#spanAbout: HTMLSpanElement;
	#ulTraits: HTMLUListElement;
	#olActs: HTMLOListElement;
	#divStoppers: HTMLDivElement;
	#pointer: number | null = null;
	#target: Cell | null = null;
	#shown: Element | null = null;
	#holder: number | null = null;

	constructor(section: HTMLElement, board: HTMLCanvasElement, crosshair: Crosshair, simulation: Simulation, templateLine: HTMLTemplateElement, templateChip: HTMLTemplateElement) {
		this.#section = section;
		this.#board = board;
		this.#crosshair = crosshair;
		this.#simulation = simulation;
		this.#templateLine = templateLine;
		this.#templateChip = templateChip;
		this.#spanTile = section.getElement(HTMLSpanElement, "span#tile");
		this.#h3Title = section.getElement(HTMLHeadingElement, "h3#title");
		this.#spanAbout = section.getElement(HTMLSpanElement, "span#about");
		this.#ulTraits = section.getElement(HTMLUListElement, "ul#traits");
		this.#olActs = section.getElement(HTMLOListElement, "ol#acts");
		this.#divStoppers = section.getElement(HTMLDivElement, "div#stoppers");
		board.addEventListener("pointerdown", event => this.#press(event));
		board.addEventListener("pointermove", event => this.#track(event));
		board.addEventListener("pointerup", event => this.#release(event));
		board.addEventListener("pointercancel", event => this.#release(event));
		board.addEventListener("contextmenu", event => event.preventDefault());
	}

	render(): void {
		const section = this.#section;
		const { inspected, holder, ticket } = this.#simulation;
		if (this.#pointer === null || inspected === null || ticket === null) {
			section.hidden = true;
			return;
		}
		section.hidden = false;
		const shown = this.#shown;
		if (shown !== null && shown.is(inspected) && this.#holder === holder) return;
		this.#shown = inspected;
		this.#holder = holder;
		this.#fill(inspected, holder, ticket);
	}

	#press(event: PointerEvent): void {
		if (this.#pointer !== null) return;
		if (event.pointerType === "mouse" && event.button !== 0) return;
		const { pointerId } = event;
		this.#board.setPointerCapture(pointerId);
		this.#pointer = pointerId;
		this.#track(event);
	}

	#track(event: PointerEvent): void {
		if (event.pointerId !== this.#pointer) return;
		const crosshair = this.#crosshair;
		const { size } = crosshair;
		if (size === null) return;
		const cell = crosshair.aim(event);
		if (cell === this.#target) return;
		this.#target = cell;
		this.#section.classList.toggle("bottom", cell !== null && cell.y < size / 2);
		this.#simulation.inspect(Nullable.map(cell, cell => cell.index(size)));
	}

	#release(event: PointerEvent): void {
		if (event.pointerId !== this.#pointer) return;
		this.#pointer = null;
		this.#target = null;
		this.#crosshair.hide();
		this.#section.hidden = true;
		this.#simulation.inspect(null);
	}

	#fill(element: Element, holder: number | null, ticket: Ticket): void {
		const { name, phase } = element;
		const { rate } = ticket.rules;
		this.#paint(this.#spanTile, element);
		this.#h3Title.textContent = name;
		this.#spanAbout.textContent = `${phase} · ${this.#owner(holder, ticket)}`;
		this.#traits(element);
		this.#acts(Sentence.acts(element, rate));
		this.#stoppers(Sentence.threats(element, rate));
	}

	#owner(holder: number | null, ticket: Ticket): string {
		if (holder === null) return "Neutral";
		if (holder === ticket.human) return "Yours";
		return "Boss";
	}

	#paint(spanTile: HTMLSpanElement, element: Element): void {
		const { style } = spanTile;
		style.setProperty("--color", element.color.toString());
		style.setProperty("--faded", element.tint(0).toString());
	}

	#traits(element: Element): void {
		const ulTraits = this.#ulTraits;
		const { heat } = element;
		ulTraits.replaceChildren(this.#trait("heat", `Heat ${heat > 0 ? "+" : ""}${heat}`));
		if (element.flammable) ulTraits.appendChild(this.#trait("flammable", "Flammable"));
		if (element.conductive) ulTraits.appendChild(this.#trait("conductive", "Conducts"));
	}

	#trait(kind: string, text: string): HTMLLIElement {
		const liTrait = document.createElement("li");
		liTrait.classList.add("trait", "depth", "rounded", "flex", "alt-center", "with-gap", "small-gap", "with-padding", "small-padding", "font-smaller-2", kind);
		const spanIcon = document.createElement("span");
		spanIcon.classList.add("icon");
		liTrait.append(spanIcon, document.createTextNode(text));
		return liTrait;
	}

	#acts(sentences: readonly Sentence[]): void {
		const olActs = this.#olActs;
		olActs.replaceChildren();
		for (const sentence of sentences) {
			olActs.appendChild(this.#line(sentence));
		}
		if (sentences.length > 0) return;
		const liEmpty = document.createElement("li");
		liEmpty.classList.add("description");
		liEmpty.textContent = "Nothing by itself: it only holds its ground.";
		olActs.appendChild(liEmpty);
	}

	#line(sentence: Sentence): HTMLLIElement {
		const fragment = document.importNode(this.#templateLine.content, true);
		const liLine = fragment.getElement(HTMLLIElement, "li");
		const pSentence = liLine.getElement(HTMLParagraphElement, "p");
		liLine.getElement(HTMLElement, "header").textContent = sentence.when;
		for (const phrase of sentence.phrases) {
			const { text, compact } = phrase;
			if (text !== null) pSentence.appendChild(document.createTextNode(text));
			for (const element of phrase.elements) {
				pSentence.appendChild(this.#chip(element, compact));
			}
		}
		return liLine;
	}

	#stoppers(sentences: readonly Sentence[]): void {
		const divStoppers = this.#divStoppers;
		const elements = Array.from(new Set(sentences.flatMap(sentence => sentence.subjects)));
		const { compact } = new Phrase(null, elements);
		divStoppers.replaceChildren();
		for (const element of elements) {
			divStoppers.appendChild(this.#chip(element, compact));
		}
		if (elements.length > 0) return;
		const spanEmpty = document.createElement("span");
		spanEmpty.classList.add("description");
		spanEmpty.textContent = "Nothing: only a drop can replace it.";
		divStoppers.appendChild(spanEmpty);
	}

	#chip(element: Element, compact: boolean): HTMLSpanElement {
		const fragment = document.importNode(this.#templateChip.content, true);
		const spanChip = fragment.getElement(HTMLSpanElement, "span.chip");
		const { name } = element;
		this.#paint(spanChip.getElement(HTMLSpanElement, "span.tile"), element);
		spanChip.getElement(HTMLSpanElement, "span.name").textContent = name;
		spanChip.classList.toggle("compact", compact);
		spanChip.title = name;
		return spanChip;
	}
}
//#endregion

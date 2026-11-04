"use strict";

import "adaptive-extender/core";
import { Field, Model, Random } from "adaptive-extender/core";
import { Element, type ElementScheme } from "./elements.js";
import { Rules } from "./rules.js";
import { PeriodicTable } from "../services/periodic-table.js";

const { min } = Math;

//#region Deck
export interface DeckScheme {
	elements: ElementScheme[];
}

export class Deck extends Model {
	@Field(Array.Of(Element), { name: "elements" })
	elements: Element[] = PeriodicTable.placeable.slice(0, Deck.capacity(new Rules()));

	static capacity(rules: Rules): number {
		return min(rules.deck, PeriodicTable.placeable.length);
	}

	static random(rules: Rules, seed: number): Deck {
		const elements = Array.from(PeriodicTable.placeable);
		new Random(seed).shuffle(elements);
		const deck = new Deck();
		deck.elements = elements.slice(0, Deck.capacity(rules));
		return deck;
	}

	get capacity(): number { return Deck.capacity(new Rules()); }
	get full(): boolean { return this.elements.length === this.capacity; }

	holds(element: Element): boolean {
		return this.elements.some(item => item.is(element));
	}

	add(element: Element): void {
		this.#admit(element);
		const { elements } = this;
		if (elements.length >= this.capacity) throw new RangeError("The deck is full");
		elements.push(element);
	}

	remove(slot: number): void;
	remove(element: Element): void;
	remove(subject: number | Element): void {
		const { elements } = this;
		const slot = typeof subject === "number" ? subject : elements.findIndex(item => item.is(subject));
		elements.splice(this.#slot(slot), 1);
	}

	place(slot: number, element: Element): void {
		const { elements } = this;
		if (slot >= elements.length) return this.add(element);
		this.#admit(element);
		elements[this.#slot(slot)] = element;
	}

	move(from: number, to: number): void {
		const { elements } = this;
		const slot = this.#slot(from);
		if (to >= elements.length) {
			elements.push(...elements.splice(slot, 1));
			return;
		}
		elements.swap(slot, this.#slot(to));
	}

	reconcile(): void {
		const { placeable } = PeriodicTable;
		const kept: Element[] = [];
		for (const element of this.elements) {
			if (!placeable.some(item => item.is(element))) continue;
			if (kept.some(item => item.is(element))) continue;
			kept.push(element);
		}
		this.elements = kept.slice(0, this.capacity);
	}

	#admit(element: Element): void {
		if (!PeriodicTable.placeable.some(item => item.is(element))) throw new TypeError(`${element.name} can't be placed`);
		if (this.holds(element)) throw new TypeError(`The deck already holds ${element.name}`);
	}

	#slot(slot: number): number {
		if (!Number.isInteger(slot) || slot < 0 || slot >= this.elements.length) throw new RangeError(`The slot ${slot} is out of the deck`);
		return slot;
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { type Element } from "../models/elements.js";

//#region Hand
export class Hand {
	#deck: readonly Element[];
	#cards: Element[] = [];
	#ages: number[];
	#random: Random;

	constructor(deck: readonly Element[], size: number, seed: number) {
		if (deck.some((element, index) => deck.findIndex(other => other.is(element)) !== index)) throw new TypeError("The deck must not repeat an element");
		if (!Number.isInteger(size) || size <= 0 || size > deck.length) throw new RangeError(`The hand size ${size} must be between 1 and the deck size ${deck.length}`);
		this.#deck = deck;
		this.#random = new Random(seed);
		this.#ages = deck.map(element => 0);
		const cards = this.#cards;
		for (let slot = 0; slot < size; slot++) {
			cards.push(this.#draw());
		}
	}

	get cards(): readonly Element[] { return this.#cards; }

	play(slot: number): Element {
		const cards = this.#cards;
		if (!Number.isInteger(slot) || slot < 0 || slot >= cards.length) throw new RangeError(`The slot ${slot} is out of the hand`);
		const [element] = cards.splice(slot, 1);
		this.#ages[this.#deck.indexOf(element)] = 0;
		cards.splice(slot, 0, this.#draw());
		return element;
	}

	#draw(): Element {
		const deck = this.#deck;
		const ages = this.#ages;
		const cards = this.#cards;
		const cases: (readonly [number, number])[] = [];
		for (let index = 0; index < deck.length; index++) {
			if (cards.includes(deck[index])) continue;
			cases.push([index, ages[index] + 1]);
		}
		const chosen = this.#random.case(cases);
		for (const [index] of cases) {
			if (index === chosen) continue;
			ages[index]++;
		}
		return deck[chosen];
	}
}
//#endregion

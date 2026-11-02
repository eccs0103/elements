"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { type Kind } from "../models/elements.js";

//#region Hand
export class Hand {
	#deck: readonly Kind[];
	#cards: Kind[] = [];
	#ages: number[];
	#random: Random;

	constructor(deck: readonly Kind[], size: number, seed: number) {
		if (new Set(deck).size !== deck.length) throw new TypeError("The deck must not repeat an element");
		if (!Number.isInteger(size) || size <= 0 || size > deck.length) throw new RangeError(`The hand size ${size} must be between 1 and the deck size ${deck.length}`);
		this.#deck = deck;
		this.#random = new Random(seed);
		this.#ages = deck.map(kind => 0);
		const cards = this.#cards;
		for (let slot = 0; slot < size; slot++) {
			cards.push(this.#draw());
		}
	}

	get cards(): readonly Kind[] { return this.#cards; }

	play(slot: number): Kind {
		const cards = this.#cards;
		if (!Number.isInteger(slot) || slot < 0 || slot >= cards.length) throw new RangeError(`The slot ${slot} is out of the hand`);
		const kind = cards[slot];
		cards.splice(slot, 1);
		this.#ages[this.#deck.indexOf(kind)] = 0;
		cards.splice(slot, 0, this.#draw());
		return kind;
	}

	#draw(): Kind {
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

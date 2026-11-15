"use strict";

import "adaptive-extender/core";
import { type Element } from "../models/elements.js";
import { PeriodicTable } from "./periodic-table.js";
import { Dice } from "./dice.js";
import { type Digest } from "./digest.js";

//#region Hand
export class Hand {
	#deck: readonly Element[];
	#cards: Element[] = [];
	#ages: number[];
	#seed: number;
	#draws: number = 0;

	constructor(deck: readonly Element[], size: number, seed: number) {
		if (deck.some((element, index) => deck.findIndex(other => other.is(element)) !== index)) throw new TypeError("The deck must not repeat an element");
		if (!Number.isInteger(size) || size <= 0 || size > deck.length) throw new RangeError(`The hand size ${size} must be between 1 and the deck size ${deck.length}`);
		this.#deck = deck;
		this.#seed = seed;
		this.#ages = deck.map(element => 0);
		const cards = this.#cards;
		for (let slot = 0; slot < size; slot++) {
			cards.push(this.#draw());
		}
	}

	get cards(): readonly Element[] { return this.#cards; }

	clone(): Hand {
		const cards = this.#cards;
		const hand = new Hand(this.#deck, cards.length, this.#seed);
		hand.#cards = [...cards];
		hand.#ages = [...this.#ages];
		hand.#draws = this.#draws;
		return hand;
	}

	feed(digest: Digest): void {
		digest.addAll(this.#cards.map(element => PeriodicTable.id(element)));
		digest.addAll(this.#ages);
		digest.add(this.#seed);
		digest.add(this.#draws);
	}

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
		const free: number[] = [];
		for (let index = 0; index < deck.length; index++) {
			if (cards.includes(deck[index])) continue;
			free.push(index);
		}
		const chosen = this.#choose(free);
		for (const index of free) {
			if (index === chosen) continue;
			ages[index]++;
		}
		return deck[chosen];
	}

	#choose(free: readonly number[]): number {
		const ages = this.#ages;
		const draws = this.#draws;
		let total = 0;
		for (const index of free) {
			total += ages[index] + 1;
		}
		this.#draws = draws + 1;
		let roll = Dice.roll(this.#seed, draws, 0, 0) % total;
		for (const index of free) {
			const weight = ages[index] + 1;
			if (roll < weight) return index;
			roll -= weight;
		}
		throw new RangeError("The hand has no card left to draw");
	}
}
//#endregion

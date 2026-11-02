"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { Move } from "../models/move.js";
import { type Match } from "./match.js";

//#region Player
export interface Player {
	act(match: Match, side: number): Move | null;
}
//#endregion
//#region Human
export class Human implements Player {
	act(match: Match, side: number): Move | null {
		void match, side;
		return null;
	}
}
//#endregion
//#region Bot
export class Bot implements Player {
	static #earliest: number = 0.6;
	static #latest: number = 1.8;
	#random: Random;
	#delay: number | null = null;

	constructor(seed: number) {
		this.#random = new Random(seed);
	}

	act(match: Match, side: number): Move | null {
		if (!match.ready(side)) {
			this.#delay = null;
			return null;
		}
		const random = this.#random;
		const { rules } = match;
		const delay = this.#delay ?? random.integer(rules.ticks(Bot.#earliest), rules.ticks(Bot.#latest));
		if (delay > 0) {
			this.#delay = delay - 1;
			return null;
		}
		this.#delay = null;
		const slot = random.integer(match.cards(side).length - 1);
		const cells = this.#candidates(match, side, slot);
		if (cells.length === 0) return null;
		const cell = random.item(cells);
		const { size } = rules;
		return new Move(match.tick, side, slot, cell % size, (cell - cell % size) / size);
	}

	#candidates(match: Match, side: number, slot: number): number[] {
		const { size } = match.rules;
		const cells: number[] = [];
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				if (match.legal(side, slot, x, y)) cells.push(y * size + x);
			}
		}
		return cells;
	}
}
//#endregion

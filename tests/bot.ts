"use strict";

import "adaptive-extender/core";
import { Move } from "../playground/models/move.js";
import { type Match } from "../playground/services/match.js";
import { type Player } from "../playground/services/players.js";
import { Dice } from "../playground/services/dice.js";

//#region Bot
export class Bot implements Player {
	static #earliest: number = 0.6;
	static #latest: number = 1.8;
	#seed: number;
	#rolls: number = 0;
	#delay: number | null = null;

	constructor(seed: number) {
		this.#seed = seed;
	}

	act(match: Match, side: number): Move | null {
		if (!match.ready(side)) {
			this.#delay = null;
			return null;
		}
		const { rules } = match;
		const delay = this.#delay ?? this.#wait(rules.ticks(Bot.#earliest), rules.ticks(Bot.#latest));
		if (delay > 0) {
			this.#delay = delay - 1;
			return null;
		}
		this.#delay = null;
		const slot = this.#roll() % match.cards(side).length;
		const cells = match.cells(side, slot);
		if (cells.length === 0) return null;
		const cell = cells[this.#roll() % cells.length];
		const { size } = rules;
		const x = cell % size;
		return new Move(match.tick, side, slot, x, (cell - x) / size);
	}

	#wait(earliest: number, latest: number): number {
		return earliest + this.#roll() % (latest - earliest + 1);
	}

	#roll(): number {
		const rolls = this.#rolls;
		this.#rolls = rolls + 1;
		return Dice.roll(this.#seed, rolls, 0, 0);
	}
}
//#endregion

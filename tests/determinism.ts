"use strict";

import "adaptive-extender/core";
import { Rules } from "../playground/models/rules.js";
import { Deck } from "../playground/models/deck.js";
import { Match } from "../playground/services/match.js";
import { type Move } from "../playground/models/move.js";
import { Bot, Human } from "../playground/services/players.js";
import { Digest } from "../playground/services/digest.js";

//#region Determinism
export class Determinism {
	static #seeds: readonly number[] = [1, 0x2F6B9A3, 0x7FFFFFFE];

	static hash(): number {
		const digest = new Digest();
		for (const seed of Determinism.#seeds) {
			digest.add(Determinism.#play(seed));
		}
		return digest.value;
	}

	static #play(seed: number): number {
		const rules = new Rules();
		const sides = Iterator.range(0, Match.count).toArray();
		const match = new Match(rules, seed, seed + 1, sides.map(side => Deck.random(rules, seed + 5 + side).elements), 0);
		const players = sides.map(side => new Bot(seed + 3 + side));
		const half = rules.length / 2;
		while (match.tick < half) {
			match.advance(players);
		}
		const clone = match.clone();
		const start = match.moves.length;
		while (!match.finished) {
			match.advance(players);
		}
		Determinism.#replay(clone, match.moves.slice(start));
		if (clone.hash !== match.hash) throw new Error(`The clone of match ${seed} drifted from the original`);
		return match.hash;
	}

	static #replay(match: Match, moves: readonly Move[]): void {
		const players = Iterator.range(0, Match.count).map(side => new Human()).toArray();
		let index = 0;
		while (!match.finished) {
			while (index < moves.length && moves[index].tick === match.tick) {
				match.play(moves[index++]);
			}
			match.advance(players);
		}
	}
}
//#endregion

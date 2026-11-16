"use strict";

import "adaptive-extender/core";
import { Rules } from "../playground/models/rules.js";
import { Match } from "../playground/services/match.js";
import { Human } from "../playground/services/players.js";
import { Digest } from "../playground/services/digest.js";
import { Ticket } from "../arena/models/protocol.js";
import { Bot } from "./bot.js";

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
		const decks = sides.map(side => Ticket.draft(rules, seed, side).elements);
		const match = new Match(rules, seed, seed + 1, decks, 0);
		const players = sides.map(side => new Bot(seed + 3 + side));
		while (!match.finished) {
			match.advance(players);
		}
		const replay = new Match(rules, seed, seed + 1, decks, 0);
		replay.replay(match.moves, sides.map(side => new Human()));
		if (replay.hash !== match.hash) throw new Error(`The replay of match ${seed} drifted from the original`);
		return match.hash;
	}
}
//#endregion

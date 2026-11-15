"use strict";

import "adaptive-extender/core";
import { Rules } from "../../playground/models/rules.js";
import { type Move } from "../../playground/models/move.js";
import { Human } from "../../playground/services/players.js";
import { Ticket, Report, Verdict } from "../models/protocol.js";

//#region Ruling
export class Ruling {
	#won: boolean;
	#scores: readonly number[] | null;

	constructor(won: boolean, scores: readonly number[] | null) {
		this.#won = won;
		this.#scores = scores;
	}

	static forfeit(): Ruling {
		return new Ruling(false, null);
	}

	get won(): boolean { return this.#won; }
	get scores(): readonly number[] | null { return this.#scores; }
}
//#endregion
//#region Referee
export class Referee {
	static #second: number = 1000;
	static #idle: number = 600000;
	static #slack: number = 15000;

	static get idle(): number { return Referee.#idle; }
	static get deadline(): number { return new Rules().seconds * Referee.#second + Referee.#slack; }

	static decide(ticket: string, moves: string | null): Ruling {
		if (moves === null) return Ruling.forfeit();
		try {
			const match = Ticket.import(JSON.parse(ticket), "ticket");
			const report = Report.import({ ticket: match.id, moves: JSON.parse(moves) }, "report");
			const verdict = Referee.#replay(match, report.moves);
			const { human } = match;
			return new Ruling(verdict.winner(human) === human, verdict.scores);
		} catch {
			// A malformed or illegal report is swallowed on purpose: it counts as a forfeit, the agent wins.
			return Ruling.forfeit();
		}
	}

	static #replay(ticket: Ticket, moves: readonly Move[]): Verdict {
		const { human } = ticket;
		if (moves.some(move => move.side !== human)) throw new TypeError("The report holds moves of a side that is not human");
		const match = ticket.match();
		const players = ticket.lineup(new Human());
		let index = 0;
		while (!match.finished) {
			while (index < moves.length && moves[index].tick === match.tick) {
				const move = moves[index++];
				if (!match.play(move)) throw new TypeError(`The move at tick ${move.tick} is illegal`);
			}
			match.advance(players);
		}
		if (index !== moves.length) throw new TypeError(`Only ${index} of ${moves.length} reported moves fit the match`);
		return Verdict.of(match);
	}
}
//#endregion

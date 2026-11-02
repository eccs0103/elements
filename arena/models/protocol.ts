"use strict";

import "adaptive-extender/core";
import { Model, Field, Nullable } from "adaptive-extender/core";
import { Rules } from "../../playground/models/rules.js";
import { Move } from "../../playground/models/move.js";
import { Match } from "../../playground/services/match.js";
import { Bot, type Player } from "../../playground/services/players.js";

//#region Ticket
export interface TicketScheme {
	id: string;
	seed: number;
	rules: Rules;
	human: number;
}

export class Ticket extends Model {
	static #route: string = "/api/tickets";

	@Field(String, { name: "id" })
	id: string;

	@Field(Number, { name: "seed" })
	seed: number;

	@Field(Rules, { name: "rules" })
	rules: Rules;

	@Field(Number, { name: "human" })
	human: number;

	constructor();
	constructor(id: string, seed: number, rules: Rules, human: number);
	constructor(id?: string, seed?: number, rules?: Rules, human?: number) {
		if (id === undefined || seed === undefined || rules === undefined || human === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.seed = seed;
		this.rules = rules;
		this.human = human;
	}

	static get route(): string { return Ticket.#route; }

	match(): Match {
		return new Match(this.rules, this.seed);
	}

	lineup(match: Match, human: Player): Player[] {
		const players: Player[] = [];
		for (let side = 0; side < match.sides; side++) {
			players.push(side === this.human ? human : new Bot(this.seed + 3 + side));
		}
		return players;
	}
}
//#endregion
//#region Report
export interface ReportScheme {
	ticket: string;
	moves: Move[];
}

export class Report extends Model {
	@Field(String, { name: "ticket" })
	ticket: string;

	@Field(Array.Of(Move), { name: "moves" })
	moves: Move[];

	constructor();
	constructor(ticket: string, moves: Move[]);
	constructor(ticket?: string, moves?: Move[]) {
		if (ticket === undefined || moves === undefined) {
			super();
			return;
		}

		super();
		this.ticket = ticket;
		this.moves = moves;
	}
}
//#endregion
//#region Verdict
export interface VerdictScheme {
	winner: number | null;
	scores: number[];
}

export class Verdict extends Model {
	static #route: string = "/api/verdicts";

	@Field(Nullable.Of(Number), { name: "winner" })
	winner: number | null;

	@Field(Array.Of(Number), { name: "scores" })
	scores: number[];

	constructor();
	constructor(winner: number | null, scores: number[]);
	constructor(winner?: number | null, scores?: number[]) {
		if (winner === undefined || scores === undefined) {
			super();
			return;
		}

		super();
		this.winner = winner;
		this.scores = scores;
	}

	static get route(): string { return Verdict.#route; }

	static of(match: Match): Verdict {
		const scores: number[] = [];
		for (let side = 0; side < match.sides; side++) {
			scores.push(match.score(side));
		}
		return new Verdict(match.winner, scores);
	}
}
//#endregion
//#region Standing
export interface StandingScheme {
	humanity: number;
	boss: number;
}

export class Standing extends Model {
	static #route: string = "/api/standing";

	@Field(Number, { name: "humanity" })
	humanity: number = 0;

	@Field(Number, { name: "boss" })
	boss: number = 0;

	static get route(): string { return Standing.#route; }

	count(verdict: Verdict, human: number): void {
		const { winner } = verdict;
		if (winner === null) return;
		if (winner === human) this.humanity++;
		else this.boss++;
	}
}
//#endregion

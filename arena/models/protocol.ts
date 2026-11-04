"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";
import { Element, type ElementScheme } from "../../playground/models/elements.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { Rules } from "../../playground/models/rules.js";
import { Move } from "../../playground/models/move.js";
import { Match } from "../../playground/services/match.js";
import { Bot, type Player } from "../../playground/services/players.js";

//#region Entry
export interface EntryScheme {
	deck: ElementScheme[];
}

export class Entry extends Model {
	@Field(Array.Of(Element), { name: "deck" })
	deck: Element[];

	constructor();
	constructor(deck: Element[]);
	constructor(deck?: Element[]) {
		if (deck === undefined) {
			super();
			return;
		}

		super();
		this.deck = deck;
	}
}
//#endregion
//#region Ticket
export interface TicketScheme {
	id: string;
	seed: number;
	rules: Rules;
	human: number;
	deck: ElementScheme[];
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

	@Field(Array.Of(Element), { name: "deck" })
	deck: Element[];

	constructor();
	constructor(id: string, seed: number, rules: Rules, human: number, deck: Element[]);
	constructor(id?: string, seed?: number, rules?: Rules, human?: number, deck?: Element[]) {
		if (id === undefined || seed === undefined || rules === undefined || human === undefined || deck === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.seed = seed;
		this.rules = rules;
		this.human = human;
		this.deck = deck;
	}

	static get route(): string { return Ticket.#route; }

	match(): Match {
		const decks = Iterator.range(0, Match.count).map(side => side === this.human ? this.deck : PeriodicTable.placeable).toArray();
		return new Match(this.rules, this.seed, decks);
	}

	lineup(human: Player): Player[] {
		return Iterator.range(0, Match.count).map(side => side === this.human ? human : new Bot(this.seed + 3 + side)).toArray();
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
	scores: number[];
}

export class Verdict extends Model {
	static #route: string = "/api/verdicts";

	@Field(Array.Of(Number), { name: "scores" })
	scores: number[];

	constructor();
	constructor(scores: number[]);
	constructor(scores?: number[]) {
		if (scores === undefined) {
			super();
			return;
		}

		super();
		this.scores = scores;
	}

	static get route(): string { return Verdict.#route; }

	static of(match: Match): Verdict {
		return new Verdict(Iterator.range(0, Match.count).map(side => match.score(side)).toArray());
	}

	get winner(): number | null {
		const [first, second] = this.scores;
		if (first === second) return null;
		return first > second ? 0 : 1;
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

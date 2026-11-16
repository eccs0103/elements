"use strict";

import "adaptive-extender/core";
import { Model, Field, Nullable } from "adaptive-extender/core";
import { Element, type ElementScheme } from "../../playground/models/elements.js";
import { Deck } from "../../playground/models/deck.js";
import { Rules, type RulesScheme } from "../../playground/models/rules.js";
import { Move, type MoveScheme } from "../../playground/models/move.js";
import { Match } from "../../playground/services/match.js";
import { Hand } from "../../playground/services/hand.js";
import { Bot, type Player } from "../../playground/services/players.js";

const { max, ceil } = Math;

//#region Entry
export interface EntryScheme {
	deck: ElementScheme[];
	token: string;
}

export class Entry extends Model {
	static #action: string = "ticket";

	@Field(Array.Of(Element), { name: "deck" })
	deck: Element[];

	@Field(String, { name: "token" })
	token: string;

	constructor();
	constructor(deck: Element[], token: string);
	constructor(deck?: Element[], token?: string) {
		if (deck === undefined || token === undefined) {
			super();
			return;
		}

		super();
		this.deck = deck;
		this.token = token;
	}

	static get action(): string { return Entry.#action; }
}
//#endregion
//#region Ticket
export interface TicketScheme {
	id: string;
	seed: number | null;
	luck: number;
	rules: RulesScheme;
	human: number;
	deck: ElementScheme[];
}

export class Ticket extends Model {
	static #route: string = "/api/tickets";
	static #second: number = 1000;
	static #idle: number = 600000;
	static #slack: number = 15000;
	static #human: number = 0;

	@Field(String, { name: "id" })
	id: string;

	@Field(Nullable.Of(Number), { name: "seed" })
	seed: number | null;

	@Field(Number, { name: "luck" })
	luck: number;

	@Field(Rules, { name: "rules" })
	rules: Rules;

	@Field(Number, { name: "human" })
	human: number;

	@Field(Array.Of(Element), { name: "deck" })
	deck: Element[];

	constructor();
	constructor(id: string, seed: number | null, luck: number, rules: Rules, human: number, deck: Element[]);
	constructor(id?: string, seed?: number | null, luck?: number, rules?: Rules, human?: number, deck?: Element[]) {
		if (id === undefined || seed === undefined || luck === undefined || rules === undefined || human === undefined || deck === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.seed = seed;
		this.luck = luck;
		this.rules = rules;
		this.human = human;
		this.deck = deck;
	}

	static get route(): string { return Ticket.#route; }
	static get idle(): number { return Ticket.#idle; }
	static get deadline(): number { return new Rules().seconds * Ticket.#second + Ticket.#slack; }
	static get human(): number { return Ticket.#human; }

	static deal(id: string, seed: number, luck: number, deck: Element[]): Ticket {
		return new Ticket(id, seed, luck, new Rules(), Ticket.#human, deck);
	}

	static draft(rules: Rules, seed: number, side: number): Deck {
		return Deck.random(rules, seed + 5 + side);
	}

	static bot(seed: number, side: number): Bot {
		return new Bot(seed + 3 + side);
	}

	get started(): boolean { return this.seed !== null; }

	sealed(): Ticket {
		return new Ticket(this.id, null, this.luck, this.rules, this.human, this.deck);
	}

	redeal(deck: Element[]): Ticket {
		return new Ticket(this.id, this.seed, this.luck, this.rules, this.human, deck);
	}

	holds(deck: readonly Element[]): boolean {
		const own = this.deck;
		return own.length === deck.length && own.every((element, index) => element.is(deck[index]));
	}

	opening(): readonly Element[] {
		return new Hand(this.deck, this.rules.hand, this.luck).cards;
	}

	match(): Match {
		const { human, deck, rules, luck } = this;
		const seed = this.#seed();
		const decks = Iterator.range(0, Match.count).map(side => side === human ? deck : Ticket.draft(rules, seed, side).elements).toArray();
		return new Match(rules, seed, luck, decks, human);
	}

	lineup(human: Player): Player[];
	lineup(human: Player, rival: Player): Player[];
	lineup(human: Player, rival?: Player): Player[] {
		const seed = this.#seed();
		return Iterator.range(0, Match.count).map(side => side === this.human ? human : rival ?? Ticket.bot(seed, side)).toArray();
	}

	#seed(): number {
		return ReferenceError.suppress(this.seed, `The ticket '${this.id}' has not started yet`);
	}
}
//#endregion
//#region Start
export interface StartScheme {
	ticket: string;
}

export class Start extends Model {
	static #route: string = "/api/starts";

	@Field(String, { name: "ticket" })
	ticket: string;

	constructor();
	constructor(ticket: string);
	constructor(ticket?: string) {
		if (ticket === undefined) {
			super();
			return;
		}

		super();
		this.ticket = ticket;
	}

	static get route(): string { return Start.#route; }
}
//#endregion
//#region Report
export interface ReportScheme {
	ticket: string;
	moves: MoveScheme[];
}

export class Report extends Model {
	static #route: string = "/api/reports";

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

	static get route(): string { return Report.#route; }

	check(rules: Rules, human: number): void {
		const { moves } = this;
		if (moves.length > rules.length / rules.pause + 1) throw new RangeError(`The report holds ${moves.length} moves, more than a match allows`);
		if (moves.some(move => move.side !== human)) throw new TypeError("The report holds moves of a side that is not human");
	}
}
//#endregion
//#region Verdict
export interface VerdictScheme {
	scores: number[];
}

export class Verdict extends Model {
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

	static of(match: Match): Verdict {
		return new Verdict(Iterator.range(0, Match.count).map(side => match.score(side)).toArray());
	}

	winner(human: number): number {
		const { scores } = this;
		const mine = scores[human];
		if (scores.every(score => score <= mine)) return human;
		return scores.indexOf(max(...scores));
	}

	against(side: number): number {
		const { scores } = this;
		return scores.reduce((sum, score) => sum + score, 0) - scores[side];
	}
}
//#endregion
//#region Standing
export interface StandingScheme {
	humanity: number;
	agent: number;
}

export class Standing extends Model {
	static #route: string = "/api/standing";

	@Field(Number, { name: "humanity" })
	humanity: number = 0;

	@Field(Number, { name: "agent" })
	agent: number = 0;

	static get route(): string { return Standing.#route; }
}
//#endregion
//#region Failure
export interface FailureScheme {
	error: string;
}

export class Failure extends Model {
	@Field(String, { name: "error" })
	error: string;

	constructor();
	constructor(error: string);
	constructor(error?: string) {
		if (error === undefined) {
			super();
			return;
		}

		super();
		this.error = error;
	}
}
//#endregion
//#region Allowance
export interface AllowanceScheme {
	left: number;
	wait: number;
}

export class Allowance extends Model {
	static #route: string = "/api/allowance";

	@Field(Number, { name: "left" })
	left: number;

	@Field(Number, { name: "wait" })
	wait: number;

	constructor();
	constructor(left: number, wait: number);
	constructor(left?: number, wait?: number) {
		if (left === undefined || wait === undefined) {
			super();
			return;
		}

		super();
		this.left = left;
		this.wait = wait;
	}

	static get route(): string { return Allowance.#route; }
}
//#endregion
//#region Shortage
export class Shortage extends Error {
	static #minute: number = 60000;
	static #status: number = 429;

	static get status(): number { return Shortage.#status; }

	static after(wait: number): Shortage {
		return new Shortage(`No matches left. The next one comes in ${ceil(wait / Shortage.#minute)} min.`);
	}
}
//#endregion

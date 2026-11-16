"use strict";

import "adaptive-extender/core";
import { Model, Field, Nullable, URI } from "adaptive-extender/core";
import { Element, type ElementScheme } from "../../playground/models/elements.js";
import { Deck } from "../../playground/models/deck.js";
import { Rules, type RulesScheme } from "../../playground/models/rules.js";
import { Move, type MoveScheme } from "../../playground/models/move.js";
import { Match } from "../../playground/services/match.js";
import { type Player } from "../../playground/services/players.js";
import { Agent, type Mind } from "../../playground/services/agent.js";
import { AgentModel, type AgentModelScheme } from "../../playground/models/agent-catalog.js";

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
	luck: number | null;
	rules: RulesScheme;
	human: number;
	deck: ElementScheme[];
	model: AgentModelScheme;
}

export class Ticket extends Model {
	static #route: string = "/api/tickets";
	static #idle: number = 600000;
	static #deadline: number = 600000;
	static #human: number = 0;

	@Field(String, { name: "id" })
	id: string;

	@Field(Nullable.Of(Number), { name: "seed" })
	seed: number | null;

	@Field(Nullable.Of(Number), { name: "luck" })
	luck: number | null;

	@Field(Rules, { name: "rules" })
	rules: Rules;

	@Field(Number, { name: "human" })
	human: number;

	@Field(Array.Of(Element), { name: "deck" })
	deck: Element[];

	@Field(AgentModel, { name: "model" })
	model: AgentModel;

	constructor();
	constructor(id: string, seed: number | null, luck: number | null, rules: Rules, human: number, deck: Element[], model: AgentModel);
	constructor(id?: string, seed?: number | null, luck?: number | null, rules?: Rules, human?: number, deck?: Element[], model?: AgentModel) {
		if (id === undefined || seed === undefined || luck === undefined || rules === undefined || human === undefined || deck === undefined || model === undefined) {
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
		this.model = model;
	}

	static locate(origin: Readonly<URI>): URI { return new URI(Ticket.#route, origin); }
	static get idle(): number { return Ticket.#idle; }
	static get deadline(): number { return Ticket.#deadline; }
	static get human(): number { return Ticket.#human; }

	static deal(id: string, seed: number, luck: number | null, deck: Element[], model: AgentModel): Ticket {
		return new Ticket(id, seed, luck, new Rules(), Ticket.#human, deck, model);
	}

	static draft(rules: Rules, seed: number, side: number): Deck {
		return Deck.random(rules, seed + 5 + side);
	}

	agent(mind: Mind): Agent {
		return new Agent(mind, this.rules.ticks(this.model.reaction));
	}

	// Not simplified: sealed, redeal and dealt each change a different field; one generic copy would need field names as strings.
	sealed(): Ticket {
		return new Ticket(this.id, null, this.luck, this.rules, this.human, this.deck, this.model);
	}

	redeal(deck: Element[]): Ticket {
		return new Ticket(this.id, this.seed, this.luck, this.rules, this.human, deck, this.model);
	}

	dealt(luck: number): Ticket {
		return new Ticket(this.id, this.seed, luck, this.rules, this.human, this.deck, this.model);
	}

	holds(deck: readonly Element[]): boolean {
		const own = this.deck;
		return own.length === deck.length && own.every((element, index) => element.is(deck[index]));
	}

	match(): Match {
		const { human, deck, rules } = this;
		const seed = ReferenceError.suppress(this.seed, `The ticket '${this.id}' has not started yet`);
		const luck = ReferenceError.suppress(this.luck, `The ticket '${this.id}' has no luck yet`);
		const decks = Iterator.range(0, Match.count).map(side => side === human ? deck : Ticket.draft(rules, seed, side).elements).toArray();
		return new Match(rules, seed, luck, decks, human);
	}

	lineup(human: Player, rival: Player): Player[] {
		return Iterator.range(0, Match.count).map(side => side === this.human ? human : rival).toArray();
	}
}
//#endregion
//#region Start
export interface StartScheme {
	ticket: string;
	luck: number;
}

export class Start extends Model {
	static #route: string = "/api/starts";
	static #limit: number = 0x7FFFFFFF;

	@Field(String, { name: "ticket" })
	ticket: string;

	@Field(Number, { name: "luck" })
	luck: number;

	constructor();
	constructor(ticket: string, luck: number);
	constructor(ticket?: string, luck?: number) {
		if (ticket === undefined || luck === undefined) {
			super();
			return;
		}

		super();
		this.ticket = ticket;
		this.luck = luck;
	}

	static locate(origin: Readonly<URI>): URI { return new URI(Start.#route, origin); }

	check(): void {
		const { luck } = this;
		const limit = Start.#limit;
		if (!Number.isInteger(luck) || luck < 0 || luck > limit) throw new RangeError(`The luck ${luck} must be an integer from 0 to ${limit}`);
	}
}
//#endregion
//#region Report
export interface ReportScheme {
	ticket: string;
	moves: MoveScheme[];
	won: boolean;
}

export class Report extends Model {
	static #route: string = "/api/reports";

	@Field(String, { name: "ticket" })
	ticket: string;

	@Field(Array.Of(Move), { name: "moves" })
	moves: Move[];

	@Field(Boolean, { name: "won" })
	won: boolean;

	constructor();
	constructor(ticket: string, moves: Move[], won: boolean);
	constructor(ticket?: string, moves?: Move[], won?: boolean) {
		if (ticket === undefined || moves === undefined || won === undefined) {
			super();
			return;
		}

		super();
		this.ticket = ticket;
		this.moves = moves;
		this.won = won;
	}

	static locate(origin: Readonly<URI>): URI { return new URI(Report.#route, origin); }

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
	review_humanity: number;
	review_agent: number;
}

export class Standing extends Model {
	static #route: string = "/api/standing";

	@Field(Number, { name: "humanity" })
	humanity: number = 0;

	@Field(Number, { name: "agent" })
	agent: number = 0;

	@Field(Number, { name: "review_humanity" })
	reviewHumanity: number = 0;

	@Field(Number, { name: "review_agent" })
	reviewAgent: number = 0;

	static locate(origin: Readonly<URI>): URI { return new URI(Standing.#route, origin); }
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
	capacity: number;
}

export class Allowance extends Model {
	static #route: string = "/api/allowance";

	@Field(Number, { name: "left" })
	left: number;

	@Field(Number, { name: "wait" })
	wait: number;

	@Field(Number, { name: "capacity" })
	capacity: number;

	constructor();
	constructor(left: number, wait: number, capacity: number);
	constructor(left?: number, wait?: number, capacity?: number) {
		if (left === undefined || wait === undefined || capacity === undefined) {
			super();
			return;
		}

		super();
		this.left = left;
		this.wait = wait;
		this.capacity = capacity;
	}

	static locate(origin: Readonly<URI>): URI { return new URI(Allowance.#route, origin); }
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

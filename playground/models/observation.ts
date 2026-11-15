"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";
import { Move } from "./move.js";
import { PeriodicTable } from "../services/periodic-table.js";
import { type Match } from "../services/match.js";

//#region Observation
export interface ObservationScheme {
	side: number;
	size: number;
	kinds: number[];
	mine: number[];
	theirs: number[];
	budgets: number[];
	reach: number[];
	cards: number[];
	planes: number[];
}

export class Observation extends Model {
	@Field(Number, { name: "side" })
	side: number;

	@Field(Number, { name: "size" })
	size: number;

	@Field(Array.Of(Number), { name: "kinds" })
	kinds: number[];

	@Field(Array.Of(Number), { name: "mine" })
	mine: number[];

	@Field(Array.Of(Number), { name: "theirs" })
	theirs: number[];

	@Field(Array.Of(Number), { name: "budgets" })
	budgets: number[];

	@Field(Array.Of(Number), { name: "reach" })
	reach: number[];

	@Field(Array.Of(Number), { name: "cards" })
	cards: number[];

	@Field(Array.Of(Number), { name: "planes" })
	planes: number[];

	constructor();
	constructor(side: number, size: number, kinds: number[], mine: number[], theirs: number[], budgets: number[], reach: number[], cards: number[], planes: number[]);
	constructor(side?: number, size?: number, kinds?: number[], mine?: number[], theirs?: number[], budgets?: number[], reach?: number[], cards?: number[], planes?: number[]) {
		if (side === undefined || size === undefined || kinds === undefined || mine === undefined || theirs === undefined || budgets === undefined || reach === undefined || cards === undefined || planes === undefined) {
			super();
			return;
		}

		super();
		this.side = side;
		this.size = size;
		this.kinds = kinds;
		this.mine = mine;
		this.theirs = theirs;
		this.budgets = budgets;
		this.reach = reach;
		this.cards = cards;
		this.planes = planes;
	}

	static #view(cell: number, area: number, side: number): number {
		return side === 1 ? area - 1 - cell : cell;
	}

	static of(match: Match, side: number): Observation {
		const { board, rules, tick } = match;
		const { size, kinds, owners, budgets } = board;
		const area = size * size;
		const rival = 1 - side;
		const owner = side + 1;
		const owner2 = rival + 1;
		const seen = new Array<number>(area);
		const mine = new Array<number>(area);
		const theirs = new Array<number>(area);
		const levels = new Array<number>(area);
		const reach = new Array<number>(area).fill(0);
		for (let cell = 0; cell < area; cell++) {
			const view = Observation.#view(cell, area, side);
			const holder = owners[cell];
			seen[view] = kinds[cell];
			mine[view] = Number(holder === owner);
			theirs[view] = Number(holder === owner2);
			levels[view] = budgets[cell] / 255;
		}
		for (const cell of match.cells(side, 0)) {
			reach[Observation.#view(cell, area, side)] = 1;
		}
		const cards = match.cards(side).map(element => PeriodicTable.id(element));
		const planes = [1 - tick / rules.length, Number(match.favoured === side), 1 - match.charge(rival), (match.score(side) - match.score(rival)) / area];
		return new Observation(side, size, seen, mine, theirs, levels, reach, cards, planes);
	}

	move(action: number, tick: number): Move {
		const { size, side } = this;
		const area = size * size;
		const cell = Observation.#view(action % area, area, side);
		const x = cell % size;
		return new Move(tick, side, Math.trunc(action / area), x, (cell - x) / size);
	}
}
//#endregion

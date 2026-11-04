"use strict";

import "adaptive-extender/core";
import { type Element } from "../models/elements.js";
import { PeriodicTable } from "./periodic-table.js";
import { type Rules } from "../models/rules.js";
import { type Move } from "../models/move.js";
import { Board } from "./board.js";
import { Hand } from "./hand.js";
import { type Player } from "./players.js";

const { abs } = Math;

//#region Side
class Side {
	#hand: Hand;
	#edge: number;
	#depth: number;
	#owner: number;
	#pause: number;
	#wait: number = 0;

	constructor(hand: Hand, edge: number, depth: number, owner: number, pause: number) {
		this.#hand = hand;
		this.#edge = edge;
		this.#depth = depth;
		this.#owner = owner;
		this.#pause = pause;
	}

	get cards(): readonly Element[] { return this.#hand.cards; }
	get owner(): number { return this.#owner; }
	get ready(): boolean { return this.#wait === 0; }
	get charge(): number {
		const pause = this.#pause;
		if (pause === 0) return 1;
		return 1 - this.#wait / pause;
	}

	armed(slot: number): boolean {
		return this.ready && Number.isInteger(slot) && slot >= 0 && slot < this.#hand.cards.length;
	}

	home(y: number): boolean {
		return abs(y - this.#edge) < this.#depth;
	}

	take(slot: number): Element {
		this.#wait = this.#pause;
		return this.#hand.play(slot);
	}

	cool(): void {
		const wait = this.#wait;
		if (wait > 0) this.#wait = wait - 1;
	}
}
//#endregion
//#region Match
export class Match {
	static #home: number = 5;
	static #count: number = 2;
	#rules: Rules;
	#board: Board;
	#sides: readonly Side[];
	#tick: number = 0;
	#moves: Move[] = [];

	constructor(rules: Rules, seed: number, decks: readonly (readonly Element[])[]) {
		const { size, hand, pause } = rules;
		const { placeable } = PeriodicTable;
		const depth = Match.#home;
		const count = Match.#count;
		if (decks.length !== count) throw new RangeError(`A match needs ${count} decks, not ${decks.length}`);
		if (decks.some(deck => deck.some(element => !placeable.some(item => item.is(element))))) throw new TypeError("A deck holds an element that can't be placed");
		const [south, north] = decks;
		this.#rules = rules;
		this.#board = new Board(size, seed);
		this.#sides = [
			new Side(new Hand(south, hand, seed + 1), size - 1, depth, 1, pause),
			new Side(new Hand(north, hand, seed + 2), 0, depth, 2, pause),
		];
	}

	static get count(): number { return Match.#count; }

	get rules(): Rules { return this.#rules; }
	get board(): Board { return this.#board; }
	get tick(): number { return this.#tick; }
	get finished(): boolean { return this.#tick >= this.#rules.length; }
	get moves(): readonly Move[] { return this.#moves; }

	cards(side: number): readonly Element[] {
		return this.#side(side).cards;
	}

	charge(side: number): number {
		return this.#side(side).charge;
	}

	ready(side: number): boolean {
		return this.#side(side).ready;
	}

	score(side: number): number {
		return this.#board.territory(this.#side(side).owner);
	}

	legal(side: number, slot: number, x: number, y: number): boolean {
		const seat = this.#side(side);
		const board = this.#board;
		const { size } = board;
		if (this.finished || !seat.armed(slot)) return false;
		if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= size || y < 0 || y >= size) return false;
		return seat.home(y) || board.touches(seat.owner, x, y);
	}

	cells(side: number, slot: number): number[] {
		const seat = this.#side(side);
		const board = this.#board;
		const { size } = board;
		const { owner } = seat;
		const cells: number[] = [];
		if (this.finished || !seat.armed(slot)) return cells;
		for (let y = 0; y < size; y++) {
			const home = seat.home(y);
			for (let x = 0; x < size; x++) {
				if (home || board.touches(owner, x, y)) cells.push(y * size + x);
			}
		}
		return cells;
	}

	play(move: Move): boolean {
		const { tick, side, slot, x, y } = move;
		if (tick !== this.#tick || !this.legal(side, slot, x, y)) return false;
		const seat = this.#side(side);
		this.#board.drop(seat.take(slot), x, y, seat.owner);
		this.#moves.push(move);
		return true;
	}

	advance(players: readonly Player[]): void {
		const sides = this.#sides;
		if (players.length !== sides.length) throw new RangeError(`The match needs ${sides.length} players, got ${players.length}`);
		if (this.finished) return;
		for (let side = 0; side < sides.length; side++) {
			const move = players[side].act(this, side);
			if (move !== null) this.play(move);
		}
		this.#board.step();
		for (const seat of sides) {
			seat.cool();
		}
		this.#tick++;
	}

	#side(side: number): Side {
		const sides = this.#sides;
		if (!Number.isInteger(side) || side < 0 || side >= sides.length) throw new RangeError(`The side ${side} does not exist`);
		return sides[side];
	}
}
//#endregion

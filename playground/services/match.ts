"use strict";

import "adaptive-extender/core";
import { type Element } from "../models/elements.js";
import { PeriodicTable } from "./periodic-table.js";
import { type Rules } from "../models/rules.js";
import { type Move } from "../models/move.js";
import { Deck } from "../models/deck.js";
import { Board } from "./board.js";
import { Hand } from "./hand.js";
import { Digest } from "./digest.js";
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

	reaches(board: Board, x: number, y: number): boolean {
		return abs(y - this.#edge) < this.#depth || board.touches(this.#owner, x, y);
	}

	feed(digest: Digest): void {
		this.#hand.feed(digest);
		digest.add(this.#wait);
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
	static #count: number = 2;
	#rules: Rules;
	#board: Board;
	#sides: readonly Side[];
	// Not simplified: Board counts the same ticks, but reading its counter would add a getter call to every tick check.
	#tick: number = 0;
	#moves: Move[] = [];
	#favoured: number;
	#claims: Set<number> = new Set();

	constructor(rules: Rules, seed: number, luck: number, decks: readonly (readonly Element[])[], favoured: number) {
		const { size, hand, pause, rows } = rules;
		const capacity = Deck.capacity(rules);
		const count = Match.#count;
		if (decks.length !== count) throw new RangeError(`A match needs ${count} decks, not ${decks.length}`);
		if (decks.some(deck => deck.length !== capacity)) throw new RangeError(`A deck must hold exactly ${capacity} elements`);
		if (decks.some(deck => deck.some(element => !PeriodicTable.places(element)))) throw new TypeError("A deck holds an element that can't be placed");
		if (!Number.isInteger(favoured) || favoured < 0 || favoured >= count) throw new RangeError(`The favoured side ${favoured} does not exist`);
		const [south, north] = decks;
		this.#rules = rules;
		this.#favoured = favoured;
		this.#board = new Board(size, seed);
		this.#sides = [
			new Side(new Hand(south, hand, luck), size - 1, rows, 1, pause),
			new Side(new Hand(north, hand, luck), 0, rows, 2, pause),
		];
	}

	static get count(): number { return Match.#count; }

	get rules(): Rules { return this.#rules; }
	get board(): Board { return this.#board; }
	get tick(): number { return this.#tick; }
	get favoured(): number { return this.#favoured; }
	get finished(): boolean { return this.#tick >= this.#rules.length; }
	get moves(): readonly Move[] { return this.#moves; }
	// Not simplified: only tests read the hash, but it is the determinism proof (Node = workerd, live = replay).
	get hash(): number {
		const digest = new Digest();
		digest.add(this.#tick);
		this.#board.feed(digest);
		for (const seat of this.#sides) {
			seat.feed(digest);
		}
		return digest.value;
	}

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

	holder(cell: number): number | null {
		const owner = this.#board.owners[cell];
		const side = this.#sides.findIndex(seat => seat.owner === owner);
		return side < 0 ? null : side;
	}

	// Not simplified: play is the only caller, but legality is its own question; merging the two would break the small-functions rule.
	#legal(side: number, slot: number, x: number, y: number): boolean {
		const seat = this.#side(side);
		const board = this.#board;
		const { size } = board;
		if (this.finished || !seat.armed(slot)) return false;
		if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= size || y < 0 || y >= size) return false;
		return seat.reaches(board, x, y);
	}

	cells(side: number, slot: number): number[] {
		const seat = this.#side(side);
		const board = this.#board;
		const { size } = board;
		const cells: number[] = [];
		if (this.finished || !seat.armed(slot)) return cells;
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				if (seat.reaches(board, x, y)) cells.push(y * size + x);
			}
		}
		return cells;
	}

	play(move: Move): boolean {
		const { tick, side, slot, x, y } = move;
		if (tick !== this.#tick || !this.#legal(side, slot, x, y)) return false;
		const seat = this.#side(side);
		const board = this.#board;
		const element = seat.take(slot);
		const cell = y * board.size + x;
		const claims = this.#claims;
		this.#moves.push(move);
		if (side === this.#favoured) claims.add(cell);
		else if (claims.has(cell)) return true;
		board.drop(element, x, y, seat.owner);
		return true;
	}

	advance(players: readonly Player[]): void {
		const drops = players.map((player, side) => player.act(this, side));
		const sides = this.#sides;
		// Not simplified: advance is public, so a caller may pass the wrong number of players.
		if (drops.length !== sides.length) throw new RangeError(`The match needs ${sides.length} drops, got ${drops.length}`);
		if (this.finished) return;
		const favoured = this.#favoured;
		for (let index = 0; index < sides.length; index++) {
			const side = (favoured + index) % sides.length;
			const drop = drops[side];
			if (drop === null) continue;
			if (drop.side !== side) throw new TypeError(`The drop of side ${side} is marked for side ${drop.side}`);
			this.play(drop);
		}
		this.#board.step();
		for (const seat of sides) {
			seat.cool();
		}
		this.#claims.clear();
		this.#tick++;
	}

	replay(moves: readonly Move[], players: readonly Player[]): void {
		let index = 0;
		while (!this.finished) {
			while (index < moves.length && moves[index].tick === this.#tick) {
				const move = moves[index++];
				if (!this.play(move)) throw new TypeError(`The move at tick ${move.tick} is illegal`);
			}
			this.advance(players);
		}
		if (index !== moves.length) throw new TypeError(`Only ${index} of ${moves.length} moves fit the match`);
	}

	#side(side: number): Side {
		const sides = this.#sides;
		if (!Number.isInteger(side) || side < 0 || side >= sides.length) throw new RangeError(`The side ${side} does not exist`);
		return sides[side];
	}
}
//#endregion

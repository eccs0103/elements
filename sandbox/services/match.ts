"use strict";

import "adaptive-extender/core";
import { Catalog, type Kind } from "../models/elements.js";
import { type Rules } from "../models/rules.js";
import { type Move } from "../models/move.js";
import { Board } from "./board.js";
import { Hand } from "./hand.js";
import { type Player } from "./players.js";

//#region Side
class Side {
	#hand: Hand;
	#home: number;
	#owner: number;
	#pause: number;
	#wait: number = 0;

	constructor(hand: Hand, home: number, owner: number, pause: number) {
		this.#hand = hand;
		this.#home = home;
		this.#owner = owner;
		this.#pause = pause;
	}

	get cards(): readonly Kind[] { return this.#hand.cards; }
	get home(): number { return this.#home; }
	get owner(): number { return this.#owner; }
	get ready(): boolean { return this.#wait === 0; }
	get charge(): number {
		const pause = this.#pause;
		if (pause === 0) return 1;
		return 1 - this.#wait / pause;
	}

	take(slot: number): Kind {
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
	#rules: Rules;
	#board: Board;
	#sides: readonly Side[];
	#tick: number = 0;
	#moves: Move[] = [];

	constructor(rules: Rules, seed: number) {
		const { size, hand, pause } = rules;
		const deck = Catalog.placeable;
		this.#rules = rules;
		this.#board = new Board(size, seed);
		this.#sides = [
			new Side(new Hand(deck, hand, seed + 1), size - 1, 1, pause),
			new Side(new Hand(deck, hand, seed + 2), 0, 2, pause),
		];
	}

	get rules(): Rules { return this.#rules; }
	get board(): Board { return this.#board; }
	get tick(): number { return this.#tick; }
	get remaining(): number { return this.#rules.length - this.#tick; }
	get finished(): boolean { return this.#tick >= this.#rules.length; }
	get moves(): readonly Move[] { return this.#moves; }
	get sides(): number { return this.#sides.length; }

	get winner(): number | null {
		const first = this.score(0);
		const second = this.score(1);
		if (first === second) return null;
		return first > second ? 0 : 1;
	}

	cards(side: number): readonly Kind[] {
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
		if (this.finished || !seat.ready) return false;
		if (!Number.isInteger(slot) || slot < 0 || slot >= seat.cards.length) return false;
		if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= size || y < 0 || y >= size) return false;
		if (seat.cards[slot] === Catalog.ground) return false;
		return y === seat.home || board.touches(seat.owner, x, y);
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

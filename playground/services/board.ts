"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { Catalog, Law, Reach, type Kind, type Reaction } from "../models/elements.js";

//#region Board
export class Board {
	static #slots: number = Catalog.elements.reduce((slots, element) => Math.max(slots, element.reactions.length), 0);
	static #orthogonal: Int8Array = Int8Array.of(0, -1, -1, 0, 1, 0, 0, 1);
	static #surrounding: Int8Array = Int8Array.of(-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1);
	static #masks: readonly (readonly Uint8Array[])[] = Board.#tabulate();
	#size: number;
	#random: Random;
	#kinds: Uint8Array;
	#budgets: Uint8Array;
	#tints: Uint8Array;
	#owners: Uint8Array;
	#progress: Uint8Array;
	#births: Uint32Array;
	#fresh: Uint8Array;
	#reverse: boolean = false;
	#candidates: Int32Array = new Int32Array(8);
	#steps: Uint8Array = new Uint8Array(Board.#slots);
	#budget: number = 0;
	#owner: number = 0;

	constructor(size: number, seed: number) {
		if (!Number.isInteger(size) || size <= 0) throw new RangeError(`The size ${size} must be a positive integer`);
		const area = size * size;
		this.#size = size;
		this.#random = new Random(seed);
		this.#kinds = new Uint8Array(area);
		this.#budgets = new Uint8Array(area);
		this.#tints = new Uint8Array(area);
		this.#owners = new Uint8Array(area);
		this.#progress = new Uint8Array(area * Board.#slots);
		this.#births = new Uint32Array(area);
		this.#fresh = new Uint8Array(area);
		for (let cell = 0; cell < area; cell++) {
			this.#spawn(cell, Catalog.ground, null, 0);
		}
	}

	static #tabulate(): readonly (readonly Uint8Array[])[] {
		const { elements } = Catalog;
		return elements.map(element => element.reactions.map(reaction => Uint8Array.from(elements, other => Number(reaction.target?.matches(other) ?? false))));
	}

	get kinds(): ArrayLike<number> { return this.#kinds; }
	get budgets(): ArrayLike<number> { return this.#budgets; }
	get tints(): ArrayLike<number> { return this.#tints; }
	get owners(): ArrayLike<number> { return this.#owners; }
	get size(): number { return this.#size; }

	drop(kind: Kind, x: number, y: number, owner: number): void {
		const size = this.#size;
		const offsets = Board.#orthogonal;
		if (x < 0 || x >= size || y < 0 || y >= size) throw new RangeError(`The cell ${x}, ${y} is out of the board`);
		this.#spawn(y * size + x, kind, null, owner);
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			this.#spawn(row * size + column, kind, null, owner);
		}
	}

	territory(owner: number): number {
		const owners = this.#owners;
		let count = 0;
		for (let cell = 0; cell < owners.length; cell++) {
			if (owners[cell] === owner) count++;
		}
		return count;
	}

	touches(owner: number, x: number, y: number): boolean {
		const size = this.#size;
		const owners = this.#owners;
		const offsets = Board.#surrounding;
		if (owners[y * size + x] === owner) return true;
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			if (owners[row * size + column] === owner) return true;
		}
		return false;
	}

	step(): void {
		const area = this.#kinds.length;
		const fresh = this.#fresh;
		const reverse = this.#reverse;
		fresh.fill(0);
		for (let index = 0; index < area; index++) {
			const cell = reverse ? area - 1 - index : index;
			if (fresh[cell] === 1) continue;
			this.#execute(cell);
		}
		this.#reverse = !reverse;
	}

	#spawn(cell: number, kind: Kind, budget: number | null, owner: number): void {
		const slots = Board.#slots;
		const value = budget ?? Catalog.at(kind).budget;
		this.#kinds[cell] = kind;
		this.#budgets[cell] = value;
		this.#tints[cell] = value;
		this.#owners[cell] = kind === Catalog.ground ? 0 : owner;
		this.#progress.fill(0, cell * slots, cell * slots + slots);
		this.#births[cell]++;
		this.#fresh[cell] = 1;
	}

	#execute(cell: number): void {
		const kind = this.#kinds[cell];
		const { reactions } = Catalog.at(kind);
		if (reactions.length === 0) return;
		const slots = Board.#slots;
		const masks = Board.#masks[kind];
		const progress = this.#progress;
		const steps = this.#steps;
		const births = this.#births;
		const budgets = this.#budgets;
		const birth = births[cell];
		const offset = cell * slots;
		for (let slot = 0; slot < slots; slot++) {
			steps[slot] = progress[offset + slot];
		}
		this.#budget = budgets[cell];
		this.#owner = this.#owners[cell];
		for (let slot = 0; slot < reactions.length; slot++) {
			const reaction = reactions[slot];
			if (steps[slot] < reaction.interval) {
				steps[slot]++;
				continue;
			}
			if (!this.#act(cell, kind, reaction, masks[slot])) continue;
			steps[slot] = 0;
			if (reaction.law === Law.ignite) this.#rekindle(reactions);
		}
		if (births[cell] !== birth) return;
		for (let slot = 0; slot < slots; slot++) {
			progress[offset + slot] = steps[slot];
		}
		budgets[cell] = this.#budget;
	}

	#rekindle(reactions: readonly Reaction[]): void {
		const steps = this.#steps;
		for (let slot = 0; slot < reactions.length; slot++) {
			if (reactions[slot].law !== Law.burnout) continue;
			steps[slot] = 0;
		}
	}

	#act(cell: number, kind: Kind, reaction: Reaction, mask: Uint8Array): boolean {
		const { law, product, remains } = reaction;
		if (law === Law.burnout) {
			if (remains !== null) this.#spawn(cell, remains, null, this.#owner);
			return false;
		}
		const found = this.#gather(cell, reaction.reach, mask);
		if (found === 0) return false;
		const budget = this.#budget;
		const limited = Catalog.at(kind).budget > 0;
		if (law === Law.spread && limited && budget <= 1) return false;
		const chosen = this.#candidates[this.#random.integer(found - 1)];
		switch (law) {
		case Law.spread: return this.#grow(chosen, kind, limited ? budget - 1 : null);
		case Law.ignite: return this.#grow(chosen, this.#require(product), null);
		case Law.cool: return this.#cool(cell, chosen, this.#require(product), this.#require(remains));
		case Law.destroy: return this.#destroy(cell, chosen, this.#require(product), this.#require(remains));
		default: throw new TypeError(`Invalid '${law}' law`);
		}
	}

	#require(kind: Kind | null): Kind {
		if (kind === null) throw new ReferenceError("The reaction has no resulting element");
		return kind;
	}

	#grow(target: number, kind: Kind, budget: number | null): boolean {
		this.#spawn(target, kind, budget, this.#owner);
		return true;
	}

	#cool(cell: number, target: number, product: Kind, remains: Kind): boolean {
		this.#spawn(target, product, null, this.#owner);
		const budget = this.#budget;
		if (budget > 0) {
			this.#budget = budget - 1;
			return true;
		}
		this.#spawn(cell, remains, null, this.#owner);
		return true;
	}

	#destroy(cell: number, target: number, product: Kind, remains: Kind): boolean {
		this.#spawn(target, product, null, this.#owner);
		this.#spawn(cell, remains, null, this.#owner);
		return true;
	}

	#gather(cell: number, reach: Reach, mask: Uint8Array): number {
		const size = this.#size;
		const kinds = this.#kinds;
		const candidates = this.#candidates;
		const offsets = reach === Reach.surrounding ? Board.#surrounding : Board.#orthogonal;
		const x = cell % size;
		const y = (cell - x) / size;
		let found = 0;
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			const neighbour = row * size + column;
			if (mask[kinds[neighbour]] === 0) continue;
			candidates[found++] = neighbour;
		}
		return found;
	}
}
//#endregion

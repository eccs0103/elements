"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { Catalog, Law, Reach, type Kind, type Reaction } from "../models/elements.js";

const { max } = Math;

//#region Neighbourhood
class Neighbourhood {
	static #orthogonal: Int8Array = Int8Array.of(0, -1, -1, 0, 1, 0, 0, 1);
	static #surrounding: Int8Array = Int8Array.of(-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1);
	#starts: Uint32Array;
	#cells: Uint32Array;

	constructor(size: number, offsets: Int8Array) {
		const area = size * size;
		const starts = this.#starts = new Uint32Array(area + 1);
		const cells: number[] = [];
		for (let cell = 0; cell < area; cell++) {
			const x = cell % size;
			const y = (cell - x) / size;
			for (let index = 0; index < offsets.length; index += 2) {
				const column = x + offsets[index];
				const row = y + offsets[index + 1];
				if (column < 0 || column >= size || row < 0 || row >= size) continue;
				cells.push(row * size + column);
			}
			starts[cell + 1] = cells.length;
		}
		this.#cells = Uint32Array.from(cells);
	}

	static orthogonal(size: number): Neighbourhood {
		return new Neighbourhood(size, Neighbourhood.#orthogonal);
	}

	static surrounding(size: number): Neighbourhood {
		return new Neighbourhood(size, Neighbourhood.#surrounding);
	}

	around(cell: number): Uint32Array {
		const starts = this.#starts;
		return this.#cells.subarray(starts[cell], starts[cell + 1]);
	}

	gather(cell: number, kinds: Uint8Array, mask: Uint8Array, candidates: Int32Array): number {
		const cells = this.#cells;
		const starts = this.#starts;
		const end = starts[cell + 1];
		let found = 0;
		for (let index = starts[cell]; index < end; index++) {
			const neighbour = cells[index];
			if (mask[kinds[neighbour]] === 0) continue;
			candidates[found++] = neighbour;
		}
		return found;
	}

	touches(cell: number, owners: Uint8Array, owner: number): boolean {
		const cells = this.#cells;
		const starts = this.#starts;
		const end = starts[cell + 1];
		for (let index = starts[cell]; index < end; index++) {
			if (owners[cells[index]] === owner) return true;
		}
		return false;
	}
}
//#endregion
//#region Board
export class Board {
	static #slots: number = max(...Catalog.elements.map(element => element.reactions.length));
	static #masks: readonly (readonly Uint8Array[])[] = Board.#tabulate();
	#size: number;
	#orthogonal: Neighbourhood;
	#surrounding: Neighbourhood;
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
		this.#orthogonal = Neighbourhood.orthogonal(size);
		this.#surrounding = Neighbourhood.surrounding(size);
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
		return elements.map(element => element.reactions.map(reaction => Uint8Array.from(elements, other => Number(reaction.affects(other)))));
	}

	get kinds(): ArrayLike<number> { return this.#kinds; }
	get tints(): ArrayLike<number> { return this.#tints; }
	get owners(): ArrayLike<number> { return this.#owners; }
	get size(): number { return this.#size; }

	drop(kind: Kind, x: number, y: number, owner: number): void {
		const size = this.#size;
		if (x < 0 || x >= size || y < 0 || y >= size) throw new RangeError(`The cell ${x}, ${y} is out of the board`);
		const cell = y * size + x;
		this.#spawn(cell, kind, null, owner);
		for (const neighbour of this.#orthogonal.around(cell)) {
			this.#spawn(neighbour, kind, null, owner);
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
		const owners = this.#owners;
		const cell = y * this.#size + x;
		return owners[cell] === owner || this.#surrounding.touches(cell, owners, owner);
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
		const owner = this.#owner;
		if (law === Law.burnout) {
			if (remains !== null) this.#spawn(cell, remains, null, owner);
			return false;
		}
		const candidates = this.#candidates;
		const neighbourhood = reaction.reach === Reach.surrounding ? this.#surrounding : this.#orthogonal;
		const found = neighbourhood.gather(cell, this.#kinds, mask, candidates);
		if (found === 0) return false;
		const budget = this.#budget;
		const limited = Catalog.at(kind).budget > 0;
		if (law === Law.spread && limited && budget <= 1) return false;
		const chosen = candidates[this.#random.integer(found - 1)];
		switch (law) {
		case Law.spread: this.#spawn(chosen, kind, limited ? budget - 1 : null, owner); break;
		case Law.ignite: this.#spawn(chosen, this.#require(product), null, owner); break;
		case Law.cool: this.#cool(cell, chosen, this.#require(product), this.#require(remains)); break;
		case Law.destroy: this.#spawn(chosen, this.#require(product), null, owner); this.#spawn(cell, this.#require(remains), null, owner); break;
		default: throw new TypeError(`Invalid '${law}' law`);
		}
		return true;
	}

	#require(kind: Kind | null): Kind {
		if (kind === null) throw new ReferenceError("The reaction has no resulting element");
		return kind;
	}

	#cool(cell: number, target: number, product: Kind, remains: Kind): void {
		const owner = this.#owner;
		const budget = this.#budget;
		this.#spawn(target, product, null, owner);
		if (budget > 0) {
			this.#budget = budget - 1;
			return;
		}
		this.#spawn(cell, remains, null, owner);
	}
}
//#endregion

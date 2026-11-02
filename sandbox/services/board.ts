"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { Catalog, Phase, type Kind, type Element } from "../models/elements.js";

const { max, trunc, sign } = Math;

//#region Board
export class Board {
	static #size: number = 81;
	static #orthogonal: Int8Array = Int8Array.of(0, -1, -1, 0, 1, 0, 0, 1);
	static #surrounding: Int8Array = Int8Array.of(-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1);
	static #ceiling: number = 0x7FFFFFFF;
	static #heats: Int8Array = Int8Array.from(Catalog.elements, element => element.heat);
	static #moist: Uint8Array = Uint8Array.from(Catalog.elements, element => Number(element.phase === Phase.liquid && element.heat < 0));
	#random: Random;
	#kinds: Uint8Array;
	#next: Uint8Array;
	#budgets: Uint8Array;
	#clocks: Uint8Array;
	#lives: Uint8Array;
	#exposures: Uint8Array;
	#candidates: Int32Array = new Int32Array(8);
	#targets: Int32Array;
	#products: Uint8Array;
	#offspring: Uint8Array;
	#sources: Int32Array;
	#ranks: Uint32Array;
	#winners: Int32Array;
	#count: number = 0;

	constructor(seed: number) {
		const size = Board.#size;
		const area = size * size;
		this.#random = new Random(seed);
		this.#kinds = new Uint8Array(area);
		this.#next = new Uint8Array(area);
		this.#budgets = new Uint8Array(area);
		this.#clocks = new Uint8Array(area);
		this.#lives = new Uint8Array(area);
		this.#exposures = new Uint8Array(area);
		this.#targets = new Int32Array(area);
		this.#products = new Uint8Array(area);
		this.#offspring = new Uint8Array(area);
		this.#sources = new Int32Array(area);
		this.#ranks = new Uint32Array(area);
		this.#winners = new Int32Array(area);
	}

	static get size(): number { return Board.#size; }
	get kinds(): ArrayLike<number> { return this.#kinds; }
	get budgets(): ArrayLike<number> { return this.#budgets; }

	generate(): void {
		const random = this.#random;
		const kinds = this.#kinds;
		for (let cell = 0; cell < kinds.length; cell++) {
			const kind = Catalog.pick(random);
			this.#spawn(kinds, cell, kind, Catalog.at(kind).budget, null);
		}
	}

	drop(kind: Kind, x: number, y: number): void {
		const size = Board.#size;
		const offsets = Board.#orthogonal;
		const kinds = this.#kinds;
		const { budget } = Catalog.at(kind);
		if (x < 0 || x >= size || y < 0 || y >= size) throw new RangeError(`The cell ${x}, ${y} is out of the board`);
		this.#spawn(kinds, y * size + x, kind, budget, null);
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			this.#spawn(kinds, row * size + column, kind, budget, null);
		}
	}

	step(): void {
		const kinds = this.#kinds;
		const next = this.#next;
		next.set(kinds);
		this.#count = 0;
		for (let cell = 0; cell < kinds.length; cell++) {
			const element = Catalog.at(kinds[cell]);
			const warmth = this.#sense(cell);
			if (this.#transform(cell, element, warmth)) continue;
			if (this.#decay(cell, element)) continue;
			this.#grow(cell, element);
		}
		this.#settle();
		kinds.set(next);
	}

	#spawn(target: Uint8Array, cell: number, kind: Kind, budget: number, life: number | null): void {
		target[cell] = kind;
		this.#budgets[cell] = budget;
		this.#clocks[cell] = 0;
		this.#lives[cell] = life ?? Catalog.at(kind).lifetime ?? 0;
		this.#exposures[cell] = 0;
	}

	#sense(cell: number): number {
		const size = Board.#size;
		const offsets = Board.#surrounding;
		const kinds = this.#kinds;
		const heats = Board.#heats;
		const x = cell % size;
		const y = (cell - x) / size;
		let warmth = 0;
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			warmth += heats[kinds[row * size + column]];
		}
		return warmth;
	}

	#intensity(cell: number, direction: number): number {
		const size = Board.#size;
		const offsets = Board.#surrounding;
		const kinds = this.#kinds;
		const heats = Board.#heats;
		const x = cell % size;
		const y = (cell - x) / size;
		let strongest = 0;
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			strongest = max(strongest, heats[kinds[row * size + column]] * direction);
		}
		return strongest;
	}

	#soaked(cell: number): boolean {
		const size = Board.#size;
		const offsets = Board.#surrounding;
		const kinds = this.#kinds;
		const moist = Board.#moist;
		const x = cell % size;
		const y = (cell - x) / size;
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			if (moist[kinds[row * size + column]] === 1) return true;
		}
		return false;
	}

	#transform(cell: number, element: Element, warmth: number): boolean {
		const fate = element.fate(warmth);
		const exposures = this.#exposures;
		if (fate === null) {
			exposures[cell] = 0;
			return false;
		}
		const exposure = exposures[cell] + this.#intensity(cell, sign(warmth));
		if (exposure <= element.inertia) {
			exposures[cell] = exposure;
			return false;
		}
		this.#spawn(this.#next, cell, fate, Catalog.at(fate).budget, element.fuel);
		return true;
	}

	#decay(cell: number, element: Element): boolean {
		if (element.lifetime === null) return false;
		const lives = this.#lives;
		const life = lives[cell];
		if (life > 1) {
			lives[cell] = life - 1;
			return false;
		}
		const ground = Catalog.ground;
		this.#spawn(this.#next, cell, ground, Catalog.at(ground).budget, null);
		return true;
	}

	#grow(cell: number, element: Element): void {
		const { spread, phase } = element;
		if (spread === null) return;
		const budget = this.#budgets[cell];
		if (budget <= 1) return;
		const clocks = this.#clocks;
		const clock = clocks[cell];
		const plant = phase === Phase.plant;
		const interval = plant && this.#soaked(cell) ? max(trunc(spread / 2), 1) : spread;
		if (clock < interval) {
			clocks[cell] = clock + 1;
			return;
		}
		const found = this.#gather(cell, plant ? Board.#surrounding : Board.#orthogonal);
		if (found === 0) return;
		const random = this.#random;
		const claim = this.#count++;
		this.#targets[claim] = this.#candidates[random.integer(found - 1)];
		this.#products[claim] = this.#kinds[cell];
		this.#offspring[claim] = budget - 1;
		this.#sources[claim] = cell;
		this.#ranks[claim] = random.integer(Board.#ceiling);
	}

	#gather(cell: number, offsets: Int8Array): number {
		const size = Board.#size;
		const kinds = this.#kinds;
		const candidates = this.#candidates;
		const ground = Catalog.ground;
		const x = cell % size;
		const y = (cell - x) / size;
		let found = 0;
		for (let index = 0; index < offsets.length; index += 2) {
			const column = x + offsets[index];
			const row = y + offsets[index + 1];
			if (column < 0 || column >= size || row < 0 || row >= size) continue;
			const neighbour = row * size + column;
			if (kinds[neighbour] !== ground) continue;
			candidates[found++] = neighbour;
		}
		return found;
	}

	#settle(): void {
		const count = this.#count;
		const targets = this.#targets;
		const ranks = this.#ranks;
		const winners = this.#winners;
		winners.fill(-1);
		for (let claim = 0; claim < count; claim++) {
			const target = targets[claim];
			const winner = winners[target];
			if (winner >= 0 && ranks[winner] >= ranks[claim]) continue;
			winners[target] = claim;
		}
		const next = this.#next;
		const products = this.#products;
		const offspring = this.#offspring;
		const clocks = this.#clocks;
		const sources = this.#sources;
		for (let claim = 0; claim < count; claim++) {
			const target = targets[claim];
			if (winners[target] !== claim) continue;
			this.#spawn(next, target, products[claim], offspring[claim], null);
			clocks[sources[claim]] = 0;
		}
	}
}
//#endregion

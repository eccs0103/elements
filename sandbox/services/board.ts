"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { Catalog, Reach, type Kind, type Ability } from "../models/elements.js";

//#region Board
export class Board {
	static #slots: number = Catalog.elements.reduce((slots, element) => Math.max(slots, element.abilities.length), 0);
	static #orthogonal: Int8Array = Int8Array.of(0, -1, -1, 0, 1, 0, 0, 1);
	static #surrounding: Int8Array = Int8Array.of(-1, -1, 0, -1, 1, -1, -1, 0, 1, 0, -1, 1, 0, 1, 1, 1);
	static #ceiling: number = 0x7FFFFFFF;
	#size: number;
	#random: Random;
	#types: Uint8Array;
	#densities: Uint8Array;
	#progress: Uint8Array;
	#candidates: Int32Array = new Int32Array(8);
	#actors: Int32Array;
	#kinds: Uint8Array;
	#abilities: Uint8Array;
	#targets: Int32Array;
	#offspring: Uint8Array;
	#ranks: Uint32Array;
	#winners: Int32Array;
	#ripening: boolean = false;

	constructor(size: number, seed: number) {
		if (!Number.isInteger(size) || size <= 0) throw new RangeError(`The size ${size} must be a positive integer`);
		const area = size * size;
		const claims = area * Board.#slots;
		this.#size = size;
		this.#random = new Random(seed);
		this.#types = new Uint8Array(area);
		this.#densities = new Uint8Array(area);
		this.#progress = new Uint8Array(claims);
		this.#actors = new Int32Array(claims);
		this.#kinds = new Uint8Array(claims);
		this.#abilities = new Uint8Array(claims);
		this.#targets = new Int32Array(claims);
		this.#offspring = new Uint8Array(claims);
		this.#ranks = new Uint32Array(claims);
		this.#winners = new Int32Array(area);
	}

	get size(): number { return this.#size; }
	get types(): ArrayLike<number> { return this.#types; }
	get densities(): ArrayLike<number> { return this.#densities; }

	generate(): void {
		const random = this.#random;
		const area = this.#types.length;
		for (let cell = 0; cell < area; cell++) {
			this.#spawn(cell, Catalog.pick(random), null);
		}
	}

	step(): boolean {
		const count = this.#claim();
		this.#resolve(count);
		return this.#apply(count) || this.#ripening;
	}

	#spawn(cell: number, kind: Kind, density: number | null): void {
		const slots = Board.#slots;
		this.#types[cell] = kind;
		this.#densities[cell] = density ?? Catalog.at(kind).density;
		this.#progress.fill(0, cell * slots, cell * slots + slots);
	}

	#claim(): number {
		const types = this.#types;
		const progress = this.#progress;
		const slots = Board.#slots;
		let count = 0;
		let ripening = false;
		for (let cell = 0; cell < types.length; cell++) {
			const { abilities } = Catalog.at(types[cell]);
			for (let slot = 0; slot < abilities.length; slot++) {
				const ability = abilities[slot];
				const index = cell * slots + slot;
				if (progress[index] < ability.preparation) {
					progress[index]++;
					ripening = true;
					continue;
				}
				if (this.#aim(cell, slot, ability, count)) count++;
			}
		}
		this.#ripening = ripening;
		return count;
	}

	#aim(cell: number, slot: number, ability: Ability, claim: number): boolean {
		const random = this.#random;
		const kind = this.#types[cell];
		const density = this.#densities[cell];
		const { target, product } = ability;
		let chosen = -1;
		let offspring = 0;
		if (target !== null && product !== null) {
			const spread = product === kind && Catalog.at(kind).density > 0;
			if (spread && density <= 1) return false;
			const found = this.#gather(cell, ability.reach, target);
			if (found === 0) return false;
			chosen = this.#candidates[random.integer(found - 1)];
			offspring = spread ? density - 1 : Catalog.at(product).density;
		}
		this.#actors[claim] = cell;
		this.#kinds[claim] = kind;
		this.#abilities[claim] = slot;
		this.#targets[claim] = chosen;
		this.#offspring[claim] = offspring;
		this.#ranks[claim] = random.integer(Board.#ceiling);
		return true;
	}

	#gather(cell: number, reach: Reach, target: Kind): number {
		const size = this.#size;
		const types = this.#types;
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
			if (types[neighbour] !== target) continue;
			candidates[found++] = neighbour;
		}
		return found;
	}

	#ability(claim: number): Ability {
		return Catalog.at(this.#kinds[claim]).abilities[this.#abilities[claim]];
	}

	#contest(cell: number, claim: number): void {
		const winners = this.#winners;
		const ranks = this.#ranks;
		const winner = winners[cell];
		if (winner >= 0 && ranks[winner] > ranks[claim]) return;
		if (winner >= 0 && ranks[winner] === ranks[claim] && winner < claim) return;
		winners[cell] = claim;
	}

	#resolve(count: number): void {
		const targets = this.#targets;
		this.#winners.fill(-1);
		for (let claim = 0; claim < count; claim++) {
			const target = targets[claim];
			if (target >= 0) this.#contest(target, claim);
			if (this.#ability(claim).remains !== null) this.#contest(this.#actors[claim], claim);
		}
	}

	#won(claim: number, reflexive: boolean): boolean {
		const winners = this.#winners;
		const target = this.#targets[claim];
		if (target >= 0 && winners[target] !== claim) return false;
		if (reflexive && winners[this.#actors[claim]] !== claim) return false;
		return true;
	}

	#apply(count: number): boolean {
		const densities = this.#densities;
		const progress = this.#progress;
		const actors = this.#actors;
		const slots = Board.#slots;
		let changed = false;
		for (let claim = 0; claim < count; claim++) {
			const actor = actors[claim];
			const ability = this.#ability(claim);
			const { remains } = ability;
			if (!this.#won(claim, remains !== null)) continue;
			changed = true;
			if (ability.renew) progress.fill(0, actor * slots, actor * slots + slots);
			else progress[actor * slots + this.#abilities[claim]] = 0;
			const target = this.#targets[claim];
			const { product } = ability;
			if (target >= 0 && product !== null) this.#spawn(target, product, this.#offspring[claim]);
			if (remains === null) continue;
			if (ability.wear && densities[actor] > 0) {
				densities[actor]--;
				continue;
			}
			this.#spawn(actor, remains, null);
		}
		return changed;
	}
}
//#endregion

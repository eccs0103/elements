"use strict";

import "adaptive-extender/core";

const { imul } = Math;

//#region Digest
export class Digest {
	static #basis: number = 0x811C9DC5;
	static #prime: number = 0x01000193;
	#value: number = Digest.#basis;

	get value(): number { return this.#value >>> 0; }

	add(value: number): void {
		const prime = Digest.#prime;
		let hash = this.#value;
		for (let shift = 0; shift < 32; shift += 8) {
			hash = imul(hash ^ ((value >>> shift) & 0xFF), prime);
		}
		this.#value = hash;
	}

	addAll(values: ArrayLike<number>): void {
		this.add(values.length);
		for (let index = 0; index < values.length; index++) {
			this.add(values[index]);
		}
	}
}
//#endregion

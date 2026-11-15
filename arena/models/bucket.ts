"use strict";

import "adaptive-extender/core";

const { max } = Math;

//#region Bucket
export class Bucket {
	static #minute: number = 60000;
	#key: string;
	#capacity: number;
	#period: number;

	constructor(key: string, capacity: number, period: number) {
		if (!Number.isInteger(capacity) || capacity <= 0) throw new RangeError(`The capacity ${capacity} must be a positive integer`);
		if (!Number.isInteger(period) || period <= 0) throw new RangeError(`The period ${period} must be a positive integer`);
		this.#key = key;
		this.#capacity = capacity;
		this.#period = period;
	}

	static visitor(user: string): Bucket {
		return new Bucket(`visitor:${user}`, 3, 10 * Bucket.#minute);
	}

	static address(address: string): Bucket {
		return new Bucket(`address:${address}`, 6, 5 * Bucket.#minute);
	}

	get key(): string { return this.#key; }
	get capacity(): number { return this.#capacity; }
	get period(): number { return this.#period; }

	wait(updated: number, now: number): number {
		return max(0, updated + this.#period - now);
	}
}
//#endregion

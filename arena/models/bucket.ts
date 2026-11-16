"use strict";

import "adaptive-extender/core";
import { Allowance } from "./protocol.js";

const { max, min, trunc } = Math;

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

	allowance(tokens: number, updated: number, now: number): Allowance {
		const capacity = this.#capacity;
		const period = this.#period;
		const passed = now - updated;
		const left = min(capacity, tokens + trunc(passed / period));
		if (left >= capacity) return new Allowance(left, 0, capacity);
		return new Allowance(left, period - passed % period, capacity);
	}

	full(): Allowance {
		const capacity = this.#capacity;
		return new Allowance(capacity, 0, capacity);
	}
}
//#endregion

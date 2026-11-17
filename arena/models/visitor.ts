"use strict";

import "adaptive-extender/core";
import { Bucket } from "./bucket.js";

//#region Visitor
export class Visitor {
	static #mapped: RegExp = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
	#user: string;
	#address: string;

	constructor(user: string, address: string) {
		this.#user = user;
		this.#address = address;
	}

	get user(): string { return this.#user; }
	get address(): string { return this.#address; }

	buckets(): Bucket[] {
		return [Bucket.address(Visitor.#network(this.#address)), Bucket.visitor(this.#user)];
	}

	static #network(address: string): string {
		if (!address.includes(":")) return address;
		const mapped = Visitor.#mapped.exec(address);
		if (mapped !== null) return mapped[1];
		const halves = address.split("::");
		const front = Visitor.#groups(halves[0]);
		const back = halves.length > 1 ? Visitor.#groups(halves[1]) : [];
		const missing = 8 - front.length - back.length;
		const groups = [...front, ...new Array<string>(missing).fill("0"), ...back];
		return `${groups.slice(0, 4).map(group => Number.parseInt(group, 16).toString(16)).join(":")}::/64`;
	}

	static #groups(part: string): string[] {
		if (String.isEmpty(part)) return [];
		return part.split(":");
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { Bucket } from "./bucket.js";

//#region Visitor
export class Visitor {
	#user: string;
	#address: string;

	constructor(user: string, address: string) {
		this.#user = user;
		this.#address = address;
	}

	get user(): string { return this.#user; }
	get address(): string { return this.#address; }

	buckets(): Bucket[] {
		return [Bucket.address(this.#address), Bucket.visitor(this.#user)];
	}
}
//#endregion

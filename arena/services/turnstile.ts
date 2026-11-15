"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional } from "adaptive-extender/core";
import { type Gate } from "./arena.js";

//#region Siteverify
class Siteverify extends Model {
	@Field(Boolean, { name: "success" })
	success: boolean;

	@Field(Optional.Of(String), { name: "hostname" })
	hostname: string | undefined;

	@Field(Optional.Of(String), { name: "action" })
	action: string | undefined;

	passes(hostnames: readonly string[], action: string): boolean {
		const { hostname } = this;
		return this.success && hostname !== undefined && hostnames.includes(hostname) && (this.action ?? "") === action;
	}
}
//#endregion
//#region Turnstile
export class Turnstile implements Gate {
	static #endpoint: string = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
	static #limit: number = 2048;
	static #timeout: number = 10000;
	#secret: string;
	#hostnames: readonly string[];
	#action: string;

	constructor(secret: string, hostnames: string, action: string) {
		this.#secret = secret;
		this.#hostnames = hostnames.split(",").map(hostname => hostname.trim()).filter(hostname => hostname.length > 0);
		this.#action = action;
	}

	async admit(token: string, address: string): Promise<void> {
		const hostnames = this.#hostnames;
		if (token.length === 0 || token.length > Turnstile.#limit || hostnames.length === 0) throw new TypeError("The bot check did not pass");
		const body = new URLSearchParams({ secret: this.#secret, response: token, remoteip: address });
		const response = await fetch(Turnstile.#endpoint, { method: "POST", body, signal: AbortSignal.timeout(Turnstile.#timeout) });
		if (!response.ok) throw new TypeError("The bot check did not answer");
		if (!Siteverify.import(await response.json(), "siteverify").passes(hostnames, this.#action)) throw new TypeError("The bot check did not pass");
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { Field, Model, Optional, URI } from "adaptive-extender/core";
import { type ArenaEnvironment } from "../models/arena-environment.js";
import { Entry } from "../models/protocol.js";
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
		return this.success && hostname !== undefined && hostnames.includes(hostname) && this.action === action;
	}
}
//#endregion
//#region Turnstile
export class Turnstile implements Gate {
	static #endpoint: URI = new URI("https://challenges.cloudflare.com/turnstile/v0/siteverify");
	static #limit: number = 2048;
	static #timeout: number = 10000;
	#environment: Readonly<ArenaEnvironment>;

	constructor(environment: Readonly<ArenaEnvironment>) {
		this.#environment = environment;
	}

	async admit(token: string, address: string): Promise<void> {
		const { secret, hostnames } = this.#environment;
		if (String.isEmpty(token) || token.length > Turnstile.#limit || hostnames.length === 0) throw new TypeError("The bot check did not pass");
		const body = new URLSearchParams({ secret, response: token, remoteip: address });
		const response = await fetch(Turnstile.#endpoint.href, { method: "POST", body, signal: AbortSignal.timeout(Turnstile.#timeout) });
		if (!response.ok) throw new TypeError("The bot check did not answer");
		if (!Siteverify.import(await response.json(), "siteverify").passes(hostnames, Entry.action)) throw new TypeError("The bot check did not pass");
	}
}
//#endregion

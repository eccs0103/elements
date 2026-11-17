"use strict";

import "adaptive-extender/worker";
import { URI } from "adaptive-extender/worker";
import { Entry, Ticket, Start, Report, Standing, Allowance, History, Failure, Refusal, Shortage } from "../models/protocol.js";

//#region Arena client
export class ArenaClient {
	static #patience: number = 10000;
	#origin: URI;

	constructor(origin: Readonly<URI>) {
		this.#origin = new URI(origin);
	}

	async open(entry: Entry): Promise<Ticket> {
		return Ticket.import(await this.#send("POST", Ticket.locate(this.#origin), Entry.export(entry)), "ticket");
	}

	async start(start: Start): Promise<Ticket> {
		return Ticket.import(await this.#send("POST", Start.locate(this.#origin), Start.export(start)), "ticket");
	}

	async report(report: Report): Promise<Standing> {
		return Standing.import(await this.#send("POST", Report.locate(this.#origin), Report.export(report)), "standing");
	}

	async standing(): Promise<Standing> {
		return Standing.import(await this.#send("GET", Standing.locate(this.#origin), null), "standing");
	}

	async allowance(): Promise<Allowance> {
		return Allowance.import(await this.#send("GET", Allowance.locate(this.#origin), null), "allowance");
	}

	async history(): Promise<History> {
		return History.import(await this.#send("GET", History.locate(this.#origin), null), "history");
	}

	async #send(method: string, target: Readonly<URI>, body: unknown): Promise<unknown> {
		const content = body === null ? null : JSON.stringify(body);
		const request = new Request(target.href, { method, body: content, headers: { ["Content-Type"]: "application/json" }, signal: AbortSignal.timeout(ArenaClient.#patience) });
		const response = await fetch(request);
		const payload = await response.json();
		if (response.ok) return payload;
		const { error } = Failure.import(payload, "failure");
		if (response.status === Shortage.status) throw new Shortage(error);
		throw new Refusal(error);
	}
}
//#endregion

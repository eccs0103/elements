"use strict";

import "adaptive-extender/worker";
import { URI } from "adaptive-extender/worker";
import { Entry, Ticket, Start, Report, Standing, Allowance, Failure, Shortage } from "../models/protocol.js";

//#region Arena client
export interface Server {
	fetch(request: Request): Promise<Response>;
}

export class ArenaClient {
	static #patience: number = 10000;
	#server: Server;
	#origin: URI;

	constructor(server: Server, origin: Readonly<URI>) {
		this.#server = server;
		this.#origin = new URI(origin);
	}

	async open(entry: Entry): Promise<Ticket> {
		return Ticket.import(await this.#send("POST", Ticket.route, Entry.export(entry)), "ticket");
	}

	async start(start: Start): Promise<Ticket> {
		return Ticket.import(await this.#send("POST", Start.route, Start.export(start)), "ticket");
	}

	async report(report: Report): Promise<Standing> {
		return Standing.import(await this.#send("POST", Report.route, Report.export(report)), "standing");
	}

	async standing(): Promise<Standing> {
		return Standing.import(await this.#send("GET", Standing.route, null), "standing");
	}

	async allowance(): Promise<Allowance> {
		return Allowance.import(await this.#send("GET", Allowance.route, null), "allowance");
	}

	async #send(method: string, route: string, body: unknown): Promise<unknown> {
		const content = body === null ? null : JSON.stringify(body);
		const request = new Request(new URI(route, this.#origin).href, { method, body: content, headers: { ["Content-Type"]: "application/json" }, signal: AbortSignal.timeout(ArenaClient.#patience) });
		const response = await this.#server.fetch(request);
		const payload = await response.json();
		if (response.ok) return payload;
		const { error } = Failure.import(payload, "failure");
		if (response.status === Shortage.status) throw new Shortage(error);
		throw new Error(error);
	}
}
//#endregion

"use strict";

import "adaptive-extender/web";
import { Ticket, Report, Verdict, Standing } from "../models/protocol.js";

//#region Arena client
export interface Server {
	fetch(request: Request): Promise<Response>;
}

export class ArenaClient {
	#server: Server;
	#origin: URL;

	constructor(server: Server, origin: Readonly<URL>) {
		this.#server = server;
		this.#origin = new URL(origin);
	}

	async open(): Promise<Ticket> {
		return Ticket.import(await this.#send("POST", Ticket.route, null), "ticket");
	}

	async judge(report: Report): Promise<Verdict> {
		return Verdict.import(await this.#send("POST", Verdict.route, Report.export(report)), "verdict");
	}

	async standing(): Promise<Standing> {
		return Standing.import(await this.#send("GET", Standing.route, null), "standing");
	}

	async #send(method: string, route: string, body: unknown): Promise<unknown> {
		const content = body === null ? null : JSON.stringify(body);
		const request = new Request(new URL(route, this.#origin), { method, body: content, headers: { ["Content-Type"]: "application/json" } });
		const response = await this.#server.fetch(request);
		const payload = await response.json();
		if (!response.ok) throw new Error(`The arena answered ${response.status}: ${JSON.stringify(payload)}`);
		return payload;
	}
}
//#endregion

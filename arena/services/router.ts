"use strict";

import "adaptive-extender/worker";
import { Entry, Ticket, Report, Verdict, Standing } from "../models/protocol.js";
import { type Arena } from "./arena.js";

//#region Arena router
export class ArenaRouter {
	#arena: Arena;

	constructor(arena: Arena) {
		this.#arena = arena;
	}

	async fetch(request: Request): Promise<Response> {
		try {
			return await this.#route(request);
		} catch (reason) {
			return Response.json({ error: Error.from(reason).message }, { status: 400 });
		}
	}

	async #route(request: Request): Promise<Response> {
		const arena = this.#arena;
		const { method } = request;
		const { pathname } = new URL(request.url);
		if (method === "POST" && pathname === Ticket.route) return Response.json(Ticket.export(await arena.open(Entry.import(await request.json(), "entry"))));
		if (method === "POST" && pathname === Verdict.route) return Response.json(Verdict.export(await arena.judge(Report.import(await request.json(), "report"))));
		if (method === "GET" && pathname === Standing.route) return Response.json(Standing.export(await arena.standing()));
		return Response.json({ error: `No route for ${method} ${pathname}` }, { status: 404 });
	}
}
//#endregion

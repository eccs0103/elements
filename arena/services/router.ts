"use strict";

import "adaptive-extender/core";
import { URI } from "adaptive-extender/core";
import { Entry, Ticket, Start, Report, Standing, Failure } from "../models/protocol.js";
import { Visitor } from "../models/visitor.js";
import { VisitorCookies } from "../../environment/workers/visitor-cookies.js";
import { Shortage, type Arena } from "./arena.js";

//#region Arena router
export class ArenaRouter {
	#arena: Arena;

	constructor(arena: Arena) {
		this.#arena = arena;
	}

	async fetch(request: Request): Promise<Response> {
		const cookies = new VisitorCookies(request);
		const response = await this.#answer(request, cookies.user);
		for (const line of cookies.issue()) {
			response.headers.append("Set-Cookie", line);
		}
		return response;
	}

	async #answer(request: Request, user: string): Promise<Response> {
		try {
			return await this.#route(request, new Visitor(user, ArenaRouter.#address(request)));
		} catch (reason) {
			const error = Error.from(reason);
			return Response.json(Failure.export(new Failure(error.message)), { status: error instanceof Shortage ? 429 : 400 });
		}
	}

	async #route(request: Request, visitor: Visitor): Promise<Response> {
		const arena = this.#arena;
		const now = Date.now();
		const { method } = request;
		const { pathname } = new URI(request.url);
		if (method === "POST" && pathname === Ticket.route) return Response.json(Ticket.export(await arena.open(Entry.import(await request.json(), "entry"), visitor, now)));
		if (method === "POST" && pathname === Start.route) return Response.json(Ticket.export(await arena.start(Start.import(await request.json(), "start"), visitor, now)));
		if (method === "POST" && pathname === Report.route) return Response.json(Standing.export(await arena.report(Report.import(await request.json(), "report"), visitor, now)));
		if (method === "GET" && pathname === Standing.route) return Response.json(Standing.export(await arena.standing()));
		return Response.json(Failure.export(new Failure(`No route for ${method} ${pathname}`)), { status: 404 });
	}

	static #address(request: Request): string {
		const address = request.headers.get("CF-Connecting-IP");
		if (address === null) throw new ReferenceError("The request carries no client address");
		return address;
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { URI } from "adaptive-extender/core";
import { Entry, Ticket, Start, Report, Standing, Allowance, Failure, Shortage } from "../models/protocol.js";
import { Visitor } from "../models/visitor.js";
import { VisitorCookies } from "../../environment/workers/visitor-cookies.js";
import { type Arena } from "./arena.js";
import { AgentCatalog, type AgentModel } from "../../playground/models/agent-catalog.js";

//#region Arena router
export class ArenaRouter {
	static #catalog: string = "/models.json";
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
			return Response.json(Failure.export(new Failure(error.message)), { status: error instanceof Shortage ? Shortage.status : 400 });
		}
	}

	async #route(request: Request, visitor: Visitor): Promise<Response> {
		const arena = this.#arena;
		const now = Date.now();
		const { method } = request;
		const { pathname } = new URI(request.url);
		if (method === "POST" && pathname === Ticket.route) return Response.json(Ticket.export(await arena.open(Entry.import(await request.json(), "entry"), visitor, await ArenaRouter.#model(request), now)));
		if (method === "POST" && pathname === Start.route) return Response.json(Ticket.export(await arena.start(Start.import(await request.json(), "start"), visitor, now)));
		if (method === "POST" && pathname === Report.route) return Response.json(Standing.export(await arena.report(Report.import(await request.json(), "report"), visitor, now)));
		if (method === "GET" && pathname === Standing.route) return Response.json(Standing.export(await arena.standing()));
		if (method === "GET" && pathname === Allowance.route) return Response.json(Allowance.export(await arena.allowance(visitor, now)));
		return Response.json(Failure.export(new Failure(`No route for ${method} ${pathname}`)), { status: 404 });
	}

	static async #model(request: Request): Promise<AgentModel> {
		const response = await fetch(new URI(ArenaRouter.#catalog, new URI(request.url)).href);
		if (!response.ok) throw new ReferenceError(`The agent catalog could not load (${response.status})`);
		return AgentCatalog.import(await response.json(), "catalog").first;
	}

	static #address(request: Request): string {
		return ReferenceError.suppress(request.headers.get("CF-Connecting-IP"), "The request carries no client address");
	}
}
//#endregion

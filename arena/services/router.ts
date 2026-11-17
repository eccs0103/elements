"use strict";

import "adaptive-extender/core";
import { URI } from "adaptive-extender/core";
import { Entry, Ticket, Start, Report, Standing, Allowance, History, Failure, Shortage } from "../models/protocol.js";
import { Visitor } from "../models/visitor.js";
import { VisitorCookies } from "../../environment/workers/visitor-cookies.js";
import { type Arena } from "./arena.js";
import { AgentCatalog, type AgentModel } from "../../playground/models/agent-catalog.js";

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
			const address = ReferenceError.suppress(request.headers.get("CF-Connecting-IP"), "The request carries no client address");
			return await this.#route(request, new Visitor(user, address));
		} catch (reason) {
			const error = Error.from(reason);
			return Response.json(Failure.export(new Failure(error.message)), { status: error instanceof Shortage ? Shortage.status : 400 });
		}
	}

	async #route(request: Request, visitor: Visitor): Promise<Response> {
		const arena = this.#arena;
		const now = Date.now();
		const { method } = request;
		const target = new URI(request.url);
		const { pathname } = target;
		if (method === "POST" && Ticket.locate(target).pathname === pathname) return Response.json(Ticket.export(await arena.open(Entry.import(await request.json(), "entry"), visitor, await ArenaRouter.#model(target), now)));
		if (method === "POST" && Start.locate(target).pathname === pathname) return Response.json(Ticket.export(await arena.start(Start.import(await request.json(), "start"), visitor, now)));
		if (method === "POST" && Report.locate(target).pathname === pathname) return Response.json(Standing.export(await arena.report(Report.import(await request.json(), "report"), visitor, now)));
		if (method === "GET" && Standing.locate(target).pathname === pathname) return Response.json(Standing.export(await arena.standing()));
		if (method === "GET" && Allowance.locate(target).pathname === pathname) return Response.json(Allowance.export(await arena.allowance(visitor, now)));
		if (method === "GET" && History.locate(target).pathname === pathname) return Response.json(History.export(await arena.history(visitor, now)));
		return Response.json(Failure.export(new Failure(`No route for ${method} ${pathname}`)), { status: 404 });
	}

	// Not simplified: Duel.#load fetches the same catalog, but AgentCatalog is core and fetch is not.
	static async #model(target: Readonly<URI>): Promise<AgentModel> {
		const response = await fetch(new URI("/models.json", target).href);
		if (!response.ok) throw new ReferenceError(`The agent catalog could not load (${response.status})`);
		return AgentCatalog.import(await response.json(), "catalog").first;
	}
}
//#endregion

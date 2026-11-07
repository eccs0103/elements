"use strict";

import "adaptive-extender/web";
import { URI } from "adaptive-extender/web";
import { Letter, Reply } from "../models/envelopes.js";

const { baseURI } = document;

//#region Relay
export class Relay {
	#worker: Worker = new Worker(new URI("../arena/controllers/server-worker.js", baseURI).href, { type: "module" });
	#pending: Map<number, PromiseWithResolvers<Response>> = new Map();
	#counter: number = 0;

	constructor() {
		this.#worker.addEventListener("message", this.#onMessage.bind(this));
	}

	async fetch(request: Request): Promise<Response> {
		const id = this.#counter++;
		const body = request.method === "GET" ? null : await request.text();
		const answer = Promise.withResolvers<Response>();
		this.#pending.set(id, answer);
		this.#worker.postMessage(Letter.export(new Letter(id, request.method, new URI(request.url).pathname, body)));
		return await answer.promise;
	}

	#onMessage(event: MessageEvent): void {
		const pending = this.#pending;
		const { id, status, body } = Reply.import(event.data, "reply");
		const answer = pending.get(id);
		if (answer === undefined) return;
		pending.delete(id);
		answer.resolve(new Response(body, { status, headers: { ["Content-Type"]: "application/json" } }));
	}
}
//#endregion

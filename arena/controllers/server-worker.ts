"use strict";

import "adaptive-extender/worker";
import { Controller, URI } from "adaptive-extender/worker";
import { Letter, Reply } from "../models/envelopes.js";
import { Arena } from "../services/arena.js";
import { IndexedLedger } from "../services/ledger.js";
import { ArenaRouter } from "../services/router.js";

//#region Server worker
class ServerWorker extends Controller {
	#router: ArenaRouter = new ArenaRouter(new Arena(new IndexedLedger()));

	async #answer(event: MessageEvent): Promise<void> {
		const { id, method, path, body } = Letter.import(event.data, "letter");
		const request = new Request(new URI(path, self.location.origin).href, { method, body });
		const response = await this.#router.fetch(request);
		self.postMessage(Reply.export(new Reply(id, response.status, await response.text())));
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#answer.bind(this));
	}
}
//#endregion

await ServerWorker.launch();

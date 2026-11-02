"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Letter, Reply } from "../models/envelopes.js";
import { Arena } from "../services/arena.js";
import { IndexedLedger } from "../services/ledger.js";
import { ArenaRouter } from "../services/router.js";

//#region Server worker
class ServerWorker extends Controller {
	#router: ArenaRouter = new ArenaRouter(new Arena(new IndexedLedger()));

	async #answer(event: MessageEvent): Promise<void> {
		const { id, method, path, body } = Letter.import(event.data, "letter");
		const request = new Request(new URL(path, self.location.origin), { method, body });
		const response = await this.#router.fetch(request);
		self.postMessage(Reply.export(new Reply(id, response.status, await response.text())));
	}

	#onMessage(event: MessageEvent): void {
		void this.#answer(event);
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await ServerWorker.launch();

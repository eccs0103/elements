"use strict";

import "adaptive-extender/core";
import { type Environment } from "adaptive-extender/core";
import { CloudflareWorker } from "../../environment/workers/cloudflare-worker.js";
import { Arena } from "../services/arena.js";
import { D1Ledger } from "../services/ledger.js";
import { Turnstile } from "../services/turnstile.js";
import { ArenaRouter } from "../services/router.js";

//#region Arena worker
interface ArenaServices {
	LEDGER: D1Database;
	TURNSTILE_SECRET: string;
	TURNSTILE_HOSTNAMES: string;
	TURNSTILE_ACTION: string;
}
type ArenaBindings = Environment & ArenaServices;

class ArenaWorker extends CloudflareWorker<ArenaBindings> {
	async run(request: Request, environment: ArenaBindings, context: ExecutionContext): Promise<Response> {
		void context;
		const { LEDGER, TURNSTILE_SECRET, TURNSTILE_HOSTNAMES, TURNSTILE_ACTION } = environment;
		const gate = new Turnstile(TURNSTILE_SECRET, TURNSTILE_HOSTNAMES, TURNSTILE_ACTION);
		return await new ArenaRouter(new Arena(new D1Ledger(LEDGER), gate)).fetch(request);
	}
}

export default new ArenaWorker();
//#endregion

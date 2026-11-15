"use strict";

import "adaptive-extender/core";
import { EnvironmentProvider, type Environment } from "adaptive-extender/core";
import { CloudflareWorker } from "../../environment/workers/cloudflare-worker.js";
import { ArenaEnvironment } from "../models/arena-environment.js";
import { Arena } from "../services/arena.js";
import { D1Ledger } from "../services/ledger.js";
import { Turnstile } from "../services/turnstile.js";
import { ArenaRouter } from "../services/router.js";

//#region Arena worker
interface ArenaServices {
	LEDGER: D1Database;
}
type ArenaBindings = Environment & ArenaServices;

class ArenaWorker extends CloudflareWorker<ArenaBindings> {
	async run(request: Request, environment: ArenaBindings, context: ExecutionContext): Promise<Response> {
		void context;
		const gate = new Turnstile(EnvironmentProvider.resolve(environment, ArenaEnvironment));
		return await new ArenaRouter(new Arena(new D1Ledger(environment.LEDGER), gate)).fetch(request);
	}
}

export default new ArenaWorker();
//#endregion

"use strict";

import "adaptive-extender/core";
import { type Environment } from "adaptive-extender/core";
import { CloudflareWorker } from "../environment/workers/cloudflare-worker.js";
import { Determinism } from "./determinism.js";

//#region Hash worker
class HashWorker extends CloudflareWorker<Environment> {
	async run(request: Request, environment: Environment, context: ExecutionContext): Promise<Response> {
		void request, environment, context;
		return new Response(String(Determinism.hash()));
	}
}

export { Determinism };
export default new HashWorker();
//#endregion

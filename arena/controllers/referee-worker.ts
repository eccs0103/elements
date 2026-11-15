"use strict";

import "adaptive-extender/core";
import { type Environment } from "adaptive-extender/core";
import { CloudflareWorker } from "../../environment/workers/cloudflare-worker.js";
import { Referee } from "../services/referee.js";

//#region Referee worker
class RefereeWorker extends CloudflareWorker<Environment> {
}

export { Referee };
export default new RefereeWorker();
//#endregion

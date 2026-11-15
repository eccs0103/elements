"use strict";

import "adaptive-extender/node";
import { Controller, EnvironmentProvider } from "adaptive-extender/node";
import { VerifierEnvironment } from "../models/verifier-environment.js";
import { Verifier } from "../services/verifier.js";

//#region Verify controller
class VerifyController extends Controller {
	async run(): Promise<void> {
		const environment = EnvironmentProvider.resolve(process.env, VerifierEnvironment);
		await new Verifier(environment).run(Date.now());
	}
}
//#endregion

await VerifyController.launch();

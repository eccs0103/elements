"use strict";

import "adaptive-extender/node";
import { Controller, EnvironmentProvider, URI } from "adaptive-extender/node";
import { VerifierEnvironment } from "../models/verifier-environment.js";
import { Verifier } from "../services/verifier.js";

//#region Verify controller
class VerifyController extends Controller {
	static #catalog: URI = new URI("../../resources/models.json", new URI(import.meta.url));

	async run(): Promise<void> {
		const environment = EnvironmentProvider.resolve(process.env, VerifierEnvironment);
		await new Verifier(environment, VerifyController.#catalog).run(Date.now());
	}
}
//#endregion

await VerifyController.launch();

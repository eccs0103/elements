"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Arena environment
export interface ArenaEnvironmentScheme {
	TURNSTILE_SECRET: string;
	TURNSTILE_HOSTNAMES: string[];
}

export class ArenaEnvironment extends Model {
	@Field(String, { name: "TURNSTILE_SECRET" })
	secret: string;

	@Field(Array.Of(String), { name: "TURNSTILE_HOSTNAMES" })
	hostnames: string[];
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Verifier environment
export interface VerifierEnvironmentScheme {
	CLOUDFLARE_ACCOUNT_ID: string;
	D1_DATABASE_ID: string;
	CLOUDFLARE_API_TOKEN: string;
}

export class VerifierEnvironment extends Model {
	@Field(String, { name: "CLOUDFLARE_ACCOUNT_ID" })
	account: string;

	@Field(String, { name: "D1_DATABASE_ID" })
	database: string;

	@Field(String, { name: "CLOUDFLARE_API_TOKEN" })
	token: string;

	get complete(): boolean {
		return ![this.account, this.database, this.token].some(String.isEmpty);
	}
}
//#endregion

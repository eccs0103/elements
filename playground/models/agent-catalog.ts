"use strict";

import "adaptive-extender/core";
import { Model, Field, URI } from "adaptive-extender/core";

//#region Agent model
export interface AgentModelScheme {
	folder: string;
	name: string;
	description: string;
	reaction: number;
	digest: string;
}

export class AgentModel extends Model {
	static #weights: string = "weights.json";

	@Field(String, { name: "folder" })
	folder: string;

	@Field(String, { name: "name" })
	name: string;

	// Not simplified: nothing reads the description yet, but it is the owner's catalog shape, stored tickets carry it and roadmap 5.22 will show it.
	@Field(String, { name: "description" })
	description: string;

	@Field(Number, { name: "reaction" })
	reaction: number;

	// Must equal the SHA-256 of weights.json: new weights in the same folder without a new digest stop the verifier.
	@Field(String, { name: "digest" })
	digest: string;

	constructor();
	constructor(folder: string, name: string, description: string, reaction: number, digest: string);
	constructor(folder?: string, name?: string, description?: string, reaction?: number, digest?: string) {
		if (folder === undefined || name === undefined || description === undefined || reaction === undefined || digest === undefined) {
			super();
			return;
		}

		super();
		this.folder = folder;
		this.name = name;
		this.description = description;
		this.reaction = reaction;
		this.digest = digest;
	}

	weights(source: Readonly<URI>): URI {
		return new URI(`${this.folder}/${AgentModel.#weights}`, source);
	}
}
//#endregion
//#region Agent catalog
export interface AgentCatalogScheme {
	models: AgentModelScheme[];
}

export class AgentCatalog extends Model {
	@Field(Array.Of(AgentModel), { name: "models" })
	models: AgentModel[];

	get first(): AgentModel {
		return ReferenceError.suppress(this.models.at(0), "The agent catalog lists no models");
	}
}
//#endregion

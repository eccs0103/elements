"use strict";

import "adaptive-extender/core";
import { Model, Field, URI } from "adaptive-extender/core";

//#region Agent model
export interface AgentModelScheme {
	folder: string;
	name: string;
	description: string;
	reaction: number;
}

export class AgentModel extends Model {
	static #weights: string = "weights.json";

	@Field(String, { name: "folder" })
	folder: string;

	@Field(String, { name: "name" })
	name: string;

	@Field(String, { name: "description" })
	description: string;

	@Field(Number, { name: "reaction" })
	reaction: number;

	constructor();
	constructor(folder: string, name: string, description: string, reaction: number);
	constructor(folder?: string, name?: string, description?: string, reaction?: number) {
		if (folder === undefined || name === undefined || description === undefined || reaction === undefined) {
			super();
			return;
		}

		super();
		this.folder = folder;
		this.name = name;
		this.description = description;
		this.reaction = reaction;
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

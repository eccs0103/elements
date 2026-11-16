"use strict";

import "adaptive-extender/core";
import { Model, Field, URI } from "adaptive-extender/core";

//#region Agent model
export interface AgentModelScheme {
	folder: string;
	name: string;
	description: string;
}

export class AgentModel extends Model {
	static #weights: string = "weights.json";

	@Field(String, { name: "folder" })
	folder: string;

	@Field(String, { name: "name" })
	name: string;

	@Field(String, { name: "description" })
	description: string;

	constructor();
	constructor(folder: string, name: string, description: string);
	constructor(folder?: string, name?: string, description?: string) {
		if (folder === undefined || name === undefined || description === undefined) {
			super();
			return;
		}

		super();
		this.folder = folder;
		this.name = name;
		this.description = description;
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

	constructor();
	constructor(models: AgentModel[]);
	constructor(models?: AgentModel[]) {
		if (models === undefined) {
			super();
			return;
		}

		super();
		this.models = models;
	}

	get first(): AgentModel {
		const { models } = this;
		if (models.length < 1) throw new ReferenceError("The agent catalog lists no models");
		return models[0];
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model, URI } from "adaptive-extender/core";
import { Observation, type ObservationScheme } from "./observation.js";

//#region Agent command
export interface AgentCommandDiscriminator extends LoadCommandDiscriminator, DecideCommandDiscriminator, DecisionCommandDiscriminator {
}

export interface AgentCommandScheme {
	$type: keyof AgentCommandDiscriminator;
}

@Descendant(Deferred(_ => LoadCommand))
@Descendant(Deferred(_ => DecideCommand))
@Descendant(Deferred(_ => DecisionCommand))
export abstract class AgentCommand extends Model {
	constructor() {
		super();
		if (new.target === AgentCommand) throw new TypeError("Unable to create an instance of an abstract class");
	}
}
//#endregion
//#region Decide command
export interface DecideCommandDiscriminator {
	"DecideCommand": DecideCommand;
}

export interface DecideCommandScheme extends AgentCommandScheme {
	$type: keyof DecideCommandDiscriminator;
	number: number;
	observation: ObservationScheme;
}

export class DecideCommand extends AgentCommand {
	@Field(Number)
	number: number;

	@Field(Observation)
	observation: Observation;

	constructor();
	constructor(number: number, observation: Observation);
	constructor(number?: number, observation?: Observation) {
		if (number === undefined || observation === undefined) {
			super();
			return;
		}

		super();
		this.number = number;
		this.observation = observation;
	}
}
//#endregion
//#region Decision command
export interface DecisionCommandDiscriminator {
	"DecisionCommand": DecisionCommand;
}

export interface DecisionCommandScheme extends AgentCommandScheme {
	$type: keyof DecisionCommandDiscriminator;
	number: number;
	action: number;
}

export class DecisionCommand extends AgentCommand {
	@Field(Number)
	number: number;

	@Field(Number)
	action: number;

	constructor();
	constructor(number: number, action: number);
	constructor(number?: number, action?: number) {
		if (number === undefined || action === undefined) {
			super();
			return;
		}

		super();
		this.number = number;
		this.action = action;
	}
}
//#endregion
//#region Load command
export interface LoadCommandDiscriminator {
	"LoadCommand": LoadCommand;
}

export interface LoadCommandScheme extends AgentCommandScheme {
	$type: keyof LoadCommandDiscriminator;
	source: string;
}

export class LoadCommand extends AgentCommand {
	@Field(URI)
	source: URI;

	constructor();
	constructor(source: URI);
	constructor(source?: URI) {
		if (source === undefined) {
			super();
			return;
		}

		super();
		this.source = source;
	}
}
//#endregion

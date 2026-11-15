"use strict";

import "adaptive-extender/core";
import { Deferred, Descendant, Field, Model } from "adaptive-extender/core";
import { Observation, type ObservationScheme } from "./observation.js";

//#region Agent command
export interface AgentCommandDiscriminator extends DecideCommandDiscriminator, DecisionCommandDiscriminator {
}

export interface AgentCommandScheme {
	$type: keyof AgentCommandDiscriminator;
}

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
	observation: ObservationScheme;
}

export class DecideCommand extends AgentCommand {
	@Field(Observation)
	observation: Observation;

	constructor();
	constructor(observation: Observation);
	constructor(observation?: Observation) {
		if (observation === undefined) {
			super();
			return;
		}

		super();
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
	action: number;
}

export class DecisionCommand extends AgentCommand {
	@Field(Number)
	action: number;

	constructor();
	constructor(action: number);
	constructor(action?: number) {
		if (action === undefined) {
			super();
			return;
		}

		super();
		this.action = action;
	}
}
//#endregion

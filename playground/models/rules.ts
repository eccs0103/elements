"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";

const { round } = Math;

//#region Rules
export interface RulesScheme {
	size: number;
	rate: number;
	seconds: number;
	cooldown: number;
	hand: number;
}

export class Rules extends Model {
	@Field(Number, { name: "size" })
	size: number = 81;

	@Field(Number, { name: "rate" })
	rate: number = 90;

	@Field(Number, { name: "seconds" })
	seconds: number = 60;

	@Field(Number, { name: "cooldown" })
	cooldown: number = 3;

	@Field(Number, { name: "hand" })
	hand: number = 3;

	get length(): number { return this.ticks(this.seconds); }
	get pause(): number { return this.ticks(this.cooldown); }

	ticks(seconds: number): number {
		return round(seconds * this.rate);
	}
}
//#endregion

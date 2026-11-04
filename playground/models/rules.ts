"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";

const { round, trunc } = Math;

//#region Rules
export interface RulesScheme {
	size: number;
	home: number;
	rate: number;
	seconds: number;
	cooldown: number;
	deck: number;
	hand: number;
}

export class Rules extends Model {
	@Field(Number, { name: "size" })
	size: number = 41;

	@Field(Number, { name: "home" })
	home: number = 1 / 3;

	@Field(Number, { name: "rate" })
	rate: number = 90;

	@Field(Number, { name: "seconds" })
	seconds: number = 60;

	@Field(Number, { name: "cooldown" })
	cooldown: number = 3;

	@Field(Number, { name: "deck" })
	deck: number = 10;

	@Field(Number, { name: "hand" })
	hand: number = 3;

	get length(): number { return this.ticks(this.seconds); }
	get pause(): number { return this.ticks(this.cooldown); }

	get rows(): number {
		const { home } = this;
		if (!(home > 0 && home <= 0.5)) throw new RangeError(`The home ${home} must be above 0 and at most a half of the board`);
		return trunc(this.size * home);
	}

	ticks(seconds: number): number {
		return round(seconds * this.rate);
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";

//#region Move
export interface MoveScheme {
	tick: number;
	side: number;
	slot: number;
	x: number;
	y: number;
}

export class Move extends Model {
	@Field(Number, { name: "tick" })
	tick: number;

	@Field(Number, { name: "side" })
	side: number;

	@Field(Number, { name: "slot" })
	slot: number;

	@Field(Number, { name: "x" })
	x: number;

	@Field(Number, { name: "y" })
	y: number;

	constructor();
	constructor(tick: number, side: number, slot: number, x: number, y: number);
	constructor(tick?: number, side?: number, slot?: number, x?: number, y?: number) {
		if (tick === undefined || side === undefined || slot === undefined || x === undefined || y === undefined) {
			super();
			return;
		}

		super();
		this.tick = tick;
		this.side = side;
		this.slot = slot;
		this.x = x;
		this.y = y;
	}
}
//#endregion

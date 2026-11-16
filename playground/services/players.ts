"use strict";

import "adaptive-extender/core";
import { type Move } from "../models/move.js";
import { type Match } from "./match.js";

//#region Player
export interface Player {
	act(match: Match, side: number): Move | null;
}
//#endregion
//#region Human
export class Human implements Player {
	act(match: Match, side: number): Move | null {
		void match, side;
		return null;
	}
}
//#endregion

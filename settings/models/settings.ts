"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum } from "adaptive-extender/core";

//#region Settings
export enum Scheme {
	system = "system",
	light = "light",
	dark = "dark",
}

export enum Mode {
	arena = "arena",
	practice = "practice",
}

export interface SettingsScheme {
	scheme: Scheme;
	mode: Mode;
}

export class Settings extends Model {
	@Field(Enum.Of(Scheme), { name: "scheme" })
	scheme: Scheme = Scheme.system;

	@Field(Enum.Of(Mode), { name: "mode" })
	mode: Mode = Mode.arena;
}
//#endregion

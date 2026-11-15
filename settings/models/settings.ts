"use strict";

import "adaptive-extender/core";
import { Model, Field, Enum } from "adaptive-extender/core";

//#region Settings
export enum Scheme {
	system = "system",
	light = "light",
	dark = "dark",
}

export interface SettingsScheme {
	scheme: Scheme;
}

export class Settings extends Model {
	@Field(Enum.Of(Scheme), { name: "scheme" })
	scheme: Scheme = Scheme.system;
}
//#endregion

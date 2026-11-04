"use strict";

import "adaptive-extender/web";
import { Model, Field, Enum } from "adaptive-extender/web";

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

	apply(): void {
		const metaScheme = document.head.getElement(HTMLMetaElement, "meta[name=\"color-scheme\"]");
		metaScheme.content = this.scheme;
	}
}
//#endregion

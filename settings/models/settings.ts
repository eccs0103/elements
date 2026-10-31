"use strict";

import "adaptive-extender/web";
import { Model, Field, Enum } from "adaptive-extender/web";

//#region Settings
export enum Scheme {
	system = "system",
	light = "light",
	dark = "dark",
}

export enum Cycle {
	terminate = "terminate",
	ask = "ask",
	repeat = "repeat",
}

export interface SettingsScheme {
	scheme: Scheme;
	counter: boolean;
	speed: number;
	size: number;
	cycle: Cycle;
}

export class Settings extends Model {
	static #slowest: number = 1;
	static #fastest: number = 240;
	static #smallest: number = 20;
	static #largest: number = 200;

	@Field(Enum.Of(Scheme), { name: "scheme" })
	scheme: Scheme = Scheme.system;

	@Field(Boolean, { name: "counter" })
	counter: boolean = false;

	@Field(Number, { name: "speed" })
	speed: number = 60;

	@Field(Number, { name: "size" })
	size: number = 50;

	@Field(Enum.Of(Cycle), { name: "cycle" })
	cycle: Cycle = Cycle.ask;

	static get slowest(): number { return Settings.#slowest; }
	static get fastest(): number { return Settings.#fastest; }
	static get smallest(): number { return Settings.#smallest; }
	static get largest(): number { return Settings.#largest; }

	apply(): void {
		const metaScheme = document.head.getElement(HTMLMetaElement, "meta[name=\"color-scheme\"]");
		metaScheme.content = this.scheme;
	}
}
//#endregion

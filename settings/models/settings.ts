"use strict";

import "adaptive-extender/web";
import { Model, Field, Enum } from "adaptive-extender/web";
import { Catalog, Kind } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";

//#region Settings
export enum Scheme {
	system = "system",
	light = "light",
	dark = "dark",
}

export interface SettingsScheme {
	scheme: Scheme;
	deck: Kind[];
}

export class Settings extends Model {
	@Field(Enum.Of(Scheme), { name: "scheme" })
	scheme: Scheme = Scheme.system;

	@Field(Array.Of(Enum.Of(Kind)), { name: "deck" })
	deck: Kind[] = Array.from(Catalog.placeable);

	holds(kind: Kind): boolean {
		return this.deck.includes(kind);
	}

	locked(kind: Kind): boolean {
		return this.holds(kind) && this.deck.length <= new Rules().hand;
	}

	toggle(kind: Kind, active: boolean): void {
		if (!active && this.locked(kind)) throw new RangeError("The deck must hold at least a full hand");
		const deck = this.deck;
		this.deck = Catalog.placeable.filter(item => item === kind ? active : deck.includes(item));
	}

	apply(): void {
		const metaScheme = document.head.getElement(HTMLMetaElement, "meta[name=\"color-scheme\"]");
		metaScheme.content = this.scheme;
	}
}
//#endregion

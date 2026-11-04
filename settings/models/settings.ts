"use strict";

import "adaptive-extender/web";
import { Model, Field, Enum } from "adaptive-extender/web";
import { Element, type ElementScheme } from "../../playground/models/elements.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { Rules } from "../../playground/models/rules.js";

//#region Settings
export enum Scheme {
	system = "system",
	light = "light",
	dark = "dark",
}

export interface SettingsScheme {
	scheme: Scheme;
	deck: ElementScheme[];
}

export class Settings extends Model {
	@Field(Enum.Of(Scheme), { name: "scheme" })
	scheme: Scheme = Scheme.system;

	@Field(Array.Of(Element), { name: "deck" })
	deck: Element[] = Array.from(PeriodicTable.placeable);

	holds(element: Element): boolean {
		return this.deck.some(item => item.is(element));
	}

	locked(element: Element): boolean {
		return this.holds(element) && this.deck.length <= new Rules().hand;
	}

	toggle(element: Element, active: boolean): void {
		if (!active && this.locked(element)) throw new RangeError("The deck must hold at least a full hand");
		const deck = this.deck;
		this.deck = PeriodicTable.placeable.filter(item => item.is(element) ? active : deck.some(other => other.is(item)));
	}

	apply(): void {
		const metaScheme = document.head.getElement(HTMLMetaElement, "meta[name=\"color-scheme\"]");
		metaScheme.content = this.scheme;
	}
}
//#endregion

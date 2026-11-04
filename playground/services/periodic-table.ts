"use strict";

import "adaptive-extender/core";
import { Dirt, Grass, Fire, Water, Lava, Ice, Element, type ElementType } from "../models/elements.js";

//#region Periodic table
export class PeriodicTable {
	static #types: readonly ElementType[] = [Dirt, Grass, Fire, Water, Lava, Ice];
	static #ground: ElementType = Dirt;
	static #elements: readonly Element[] = PeriodicTable.#types.map(type => new type());
	static #placeable: readonly Element[] = PeriodicTable.#elements.filter(element => !(element instanceof PeriodicTable.#ground));

	static get elements(): readonly Element[] { return PeriodicTable.#elements; }
	static get ground(): Element { return PeriodicTable.at(PeriodicTable.id(PeriodicTable.#ground)); }
	static get placeable(): readonly Element[] { return PeriodicTable.#placeable; }

	static id(element: Element): number;
	static id(type: ElementType): number;
	static id(subject: Element | ElementType): number {
		const id = subject instanceof Element ? PeriodicTable.#elements.findIndex(element => element.is(subject)) : PeriodicTable.#types.indexOf(subject);
		if (id < 0) throw new TypeError("The element is not in the periodic table");
		return id;
	}

	static at(id: number): Element {
		const elements = PeriodicTable.#elements;
		if (!Number.isInteger(id) || id < 0 || id >= elements.length) throw new RangeError(`The element ${id} is not in the periodic table`);
		return elements[id];
	}
}
//#endregion

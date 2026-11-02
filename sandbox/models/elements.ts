"use strict";

import "adaptive-extender/core";
import { Color, type Random } from "adaptive-extender/core";

//#region Element
export enum Kind {
	dirt,
	grass,
	fire,
	water,
	lava,
	ice,
}

export enum Phase {
	powder = "powder",
	plant = "plant",
	energy = "energy",
	liquid = "liquid",
	solid = "solid",
}

export interface ElementTraits {
	name: string;
	color: Readonly<Color>;
	faded: Readonly<Color>;
	weight: number;
	phase: Phase;
	heat: number;
	spread: number | null;
	budget: number;
	fuel: number | null;
	lifetime: number | null;
	hot: Kind | null;
	cold: Kind | null;
	inertia: number;
}

export class Element {
	static #boiling: number = 2;
	static #freezing: number = -2;
	#traits: Readonly<ElementTraits>;

	constructor(traits: Readonly<ElementTraits>) {
		this.#traits = traits;
	}

	get name(): string { return this.#traits.name; }
	get color(): Readonly<Color> { return this.#traits.color; }
	get weight(): number { return this.#traits.weight; }
	get phase(): Phase { return this.#traits.phase; }
	get heat(): number { return this.#traits.heat; }
	get spread(): number | null { return this.#traits.spread; }
	get budget(): number { return this.#traits.budget; }
	get fuel(): number | null { return this.#traits.fuel; }
	get lifetime(): number | null { return this.#traits.lifetime; }
	get hot(): Kind | null { return this.#traits.hot; }
	get cold(): Kind | null { return this.#traits.cold; }
	get inertia(): number { return this.#traits.inertia; }

	fate(warmth: number): Kind | null {
		const { hot, cold } = this.#traits;
		if (warmth >= Element.#boiling) return hot;
		if (warmth <= Element.#freezing) return cold;
		return null;
	}

	tint(budget: number): Color {
		const { color, faded, budget: maximum } = this.#traits;
		if (maximum === 0) return new Color(color);
		return Color.mix(faded, color, budget / maximum);
	}
}
//#endregion
//#region Catalog
export class Catalog {
	static #dirt: Readonly<Color> = Color.fromRGB(150, 100, 80);
	static #grass: Readonly<Color> = Color.fromRGB(0, 128, 0);
	static #fire: Readonly<Color> = Color.fromRGB(255, 150, 0);
	static #water: Readonly<Color> = Color.fromRGB(0, 50, 255);
	static #lava: Readonly<Color> = Color.fromRGB(255, 0, 0);
	static #ice: Readonly<Color> = Color.fromRGB(0, 200, 255);

	static #elements: readonly Element[] = [
		new Element({ name: "Dirt", color: Catalog.#dirt, faded: Catalog.#dirt, weight: 90, phase: Phase.powder, heat: 0, spread: null, budget: 0, fuel: null, lifetime: null, hot: null, cold: null, inertia: 0 }),
		new Element({ name: "Grass", color: Catalog.#grass, faded: Catalog.#grass, weight: 4, phase: Phase.plant, heat: 0, spread: 10, budget: 16, fuel: 16, lifetime: null, hot: Kind.fire, cold: null, inertia: 8 }),
		new Element({ name: "Fire", color: Catalog.#fire, faded: Catalog.#fire, weight: 2, phase: Phase.energy, heat: 2, spread: null, budget: 0, fuel: null, lifetime: 16, hot: null, cold: Kind.dirt, inertia: 16 }),
		new Element({ name: "Water", color: Catalog.#water, faded: Catalog.#water, weight: 2, phase: Phase.liquid, heat: -2, spread: 8, budget: 12, fuel: null, lifetime: null, hot: Kind.dirt, cold: null, inertia: 16 }),
		new Element({ name: "Lava", color: Catalog.#lava, faded: Catalog.#fire, weight: 1, phase: Phase.liquid, heat: 3, spread: 15, budget: 4, fuel: null, lifetime: null, hot: null, cold: Kind.dirt, inertia: 16 }),
		new Element({ name: "Ice", color: Catalog.#ice, faded: Catalog.#water, weight: 1, phase: Phase.solid, heat: -2, spread: 12, budget: 4, fuel: null, lifetime: null, hot: Kind.water, cold: null, inertia: 24 }),
	];

	static #cases: readonly (readonly [Kind, number])[] = Catalog.#elements.map((element, kind) => [kind, element.weight] as const);

	static #total: number = Catalog.#elements.reduce((total, element) => total + element.weight, 0);

	static get elements(): readonly Element[] { return Catalog.#elements; }
	static get ground(): Kind { return Kind.dirt; }

	static at(kind: Kind): Element {
		return Catalog.#elements[kind];
	}

	static pick(random: Random): Kind {
		return random.case(Catalog.#cases);
	}

	static chance(element: Element): number {
		return element.weight / Catalog.#total;
	}
}
//#endregion

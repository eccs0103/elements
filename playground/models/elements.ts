"use strict";

import "adaptive-extender/core";
import { Color } from "adaptive-extender/core";

//#region Reaction
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

export enum Climate {
	any,
	hot,
	cold,
}

export enum Law {
	spread,
	ignite,
	cool,
	destroy,
	burnout,
}

export enum Reach {
	none = 0,
	orthogonal = 4,
	surrounding = 8,
}

export class Selector {
	#phase: Phase | null;
	#climate: Climate;
	#flammable: boolean;

	constructor(phase: Phase | null, climate: Climate, flammable: boolean) {
		this.#phase = phase;
		this.#climate = climate;
		this.#flammable = flammable;
	}

	static of(phase: Phase, climate: Climate): Selector {
		return new Selector(phase, climate, false);
	}

	static flammable(): Selector {
		return new Selector(null, Climate.any, true);
	}

	matches(element: Element): boolean {
		const phase = this.#phase;
		const climate = this.#climate;
		if (this.#flammable && !element.flammable) return false;
		if (phase !== null && element.phase !== phase) return false;
		if (climate === Climate.hot && element.heat <= 0) return false;
		if (climate === Climate.cold && element.heat >= 0) return false;
		return true;
	}
}

export class Reaction {
	#name: string;
	#description: string;
	#law: Law;
	#interval: number;
	#reach: Reach;
	#target: Selector | null;
	#product: Kind | null;
	#remains: Kind | null;

	constructor(name: string, description: string, law: Law, interval: number, reach: Reach, target: Selector | null, product: Kind | null, remains: Kind | null) {
		if (!Number.isInteger(interval) || interval <= 0) throw new RangeError(`The interval ${interval} must be a positive integer`);
		this.#name = name;
		this.#description = description;
		this.#law = law;
		this.#interval = interval;
		this.#reach = reach;
		this.#target = target;
		this.#product = product;
		this.#remains = remains;
	}

	static spread(name: string, description: string, interval: number, reach: Reach, target: Selector): Reaction {
		return new Reaction(name, description, Law.spread, interval, reach, target, null, null);
	}

	static ignite(name: string, description: string, interval: number, target: Selector, product: Kind): Reaction {
		return new Reaction(name, description, Law.ignite, interval, Reach.orthogonal, target, product, null);
	}

	static cool(name: string, description: string, interval: number, target: Selector, product: Kind, remains: Kind): Reaction {
		return new Reaction(name, description, Law.cool, interval, Reach.orthogonal, target, product, remains);
	}

	static destroy(name: string, description: string, interval: number, target: Selector, product: Kind, remains: Kind): Reaction {
		return new Reaction(name, description, Law.destroy, interval, Reach.orthogonal, target, product, remains);
	}

	static burnout(name: string, description: string, interval: number, remains: Kind): Reaction {
		return new Reaction(name, description, Law.burnout, interval, Reach.none, null, null, remains);
	}

	get name(): string { return this.#name; }
	get description(): string { return this.#description; }
	get law(): Law { return this.#law; }
	get interval(): number { return this.#interval; }
	get reach(): Reach { return this.#reach; }
	get product(): Kind | null { return this.#product; }
	get remains(): Kind | null { return this.#remains; }

	affects(element: Element): boolean {
		return this.#target?.matches(element) ?? false;
	}
}
//#endregion
//#region Element
export interface ElementTraits {
	name: string;
	color: Readonly<Color>;
	faded: Readonly<Color>;
	phase: Phase;
	heat: number;
	flammable: boolean;
	budget: number;
	reactions: readonly Reaction[];
}

export class Element {
	#traits: Readonly<ElementTraits>;

	constructor(traits: Readonly<ElementTraits>) {
		this.#traits = traits;
	}

	get name(): string { return this.#traits.name; }
	get color(): Readonly<Color> { return this.#traits.color; }
	get phase(): Phase { return this.#traits.phase; }
	get heat(): number { return this.#traits.heat; }
	get flammable(): boolean { return this.#traits.flammable; }
	get budget(): number { return this.#traits.budget; }
	get reactions(): readonly Reaction[] { return this.#traits.reactions; }

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
	static #soil: Selector = Selector.of(Phase.powder, Climate.any);
	static #flames: Selector = Selector.of(Phase.energy, Climate.hot);
	static #magma: Selector = Selector.of(Phase.liquid, Climate.hot);
	static #moisture: Selector = Selector.of(Phase.liquid, Climate.cold);
	static #fuel: Selector = Selector.flammable();

	static #elements: readonly Element[] = [
		new Element({ name: "Dirt", color: Catalog.#dirt, faded: Catalog.#dirt, phase: Phase.powder, heat: 0, flammable: false, budget: 0, reactions: [] }),
		new Element({ name: "Grass", color: Catalog.#grass, faded: Catalog.#grass, phase: Phase.plant, heat: 0, flammable: true, budget: 0, reactions: [
			Reaction.spread("Grow", "Grass can expand by converting a random adjacent Dirt element into a Grass element. The ability targets the eight neighboring cells (up, down, left, right, and diagonals) to find a Dirt element and transform it.", 10, Reach.surrounding, Catalog.#soil),
		] }),
		new Element({ name: "Fire", color: Catalog.#fire, faded: Catalog.#fire, phase: Phase.energy, heat: 2, flammable: false, budget: 0, reactions: [
			Reaction.ignite("Burn", "Fire spreads by converting a random adjacent Grass element into a Fire element. It targets the four neighboring cells (up, down, left, right) to find a Grass element and ignite it. When Fire successfully spreads, it resets the progress of the Fade ability.", 4, Catalog.#fuel, Kind.fire),
			Reaction.burnout("Fade", "When Fire burns out, it converts itself into a Dirt element. This ability is triggered when Fire has not spread to a new Grass element after a certain period, indicating the fire has exhausted its fuel and extinguishes itself.", 16, Kind.dirt),
		] }),
		new Element({ name: "Water", color: Catalog.#water, faded: Catalog.#water, phase: Phase.liquid, heat: -1, flammable: false, budget: 0, reactions: [
			Reaction.spread("Flow", "Water can spread by converting a random adjacent Dirt element into a Water element. This ability targets the eight neighboring cells to find a Dirt element and transform it into Water.", 8, Reach.surrounding, Catalog.#soil),
			Reaction.destroy("Evaporate", "Water evaporates when it encounters Fire. This ability converts a random adjacent Fire element and itself into Dirt elements. It targets the four neighboring cells to find a Fire element and then transforms both the Fire and Water into Dirt, simulating the evaporation process.", 8, Catalog.#flames, Kind.dirt, Kind.dirt),
		] }),
		new Element({ name: "Lava", color: Catalog.#lava, faded: Catalog.#fire, phase: Phase.liquid, heat: 3, flammable: false, budget: 3, reactions: [
			Reaction.spread("Flow", "Lava can spread by converting a random adjacent Dirt element into a Lava element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Lava. The new Lava element will have a reduced density compared to the original.", 15, Reach.orthogonal, Catalog.#soil),
			Reaction.ignite("Burn", "Lava can ignite Grass by converting a random adjacent Grass element into a Fire element. It targets the four neighboring cells to find a Grass element and set it on fire.", 8, Catalog.#fuel, Kind.fire),
			Reaction.cool("Fade", "Lava cools down when it encounters Water. This ability converts a random adjacent Water element into a Dirt element and decreases the Lava's density. It targets the four neighboring cells to find a Water element. If the Lava's density reaches zero, it transforms itself into a Fire element, simulating the cooling process.", 4, Catalog.#moisture, Kind.dirt, Kind.fire),
		] }),
		new Element({ name: "Ice", color: Catalog.#ice, faded: Catalog.#water, phase: Phase.solid, heat: -2, flammable: false, budget: 3, reactions: [
			Reaction.spread("Flow", "Ice can spread by converting a random adjacent Dirt element into an Ice element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Ice. The new Ice element will have a reduced density compared to the original.", 12, Reach.orthogonal, Catalog.#soil),
			Reaction.cool("Melt", "Ice melts when it encounters Fire. This ability converts a random adjacent Fire element into a Dirt element and decreases the Ice's density. It targets the four neighboring cells to find a Fire element. If the Ice's density reaches zero, it transforms itself into a Water element, simulating the melting process.", 4, Catalog.#flames, Kind.dirt, Kind.water),
			Reaction.destroy("Evaporate", "Ice evaporates when it encounters Lava. This ability converts a random adjacent Lava element and itself into Dirt elements. It targets the four neighboring cells to find a Lava element and then transforms both the Lava and Ice into Dirt, simulating the evaporation process.", 4, Catalog.#magma, Kind.dirt, Kind.dirt),
		] }),
	];

	static #placeable: readonly Kind[] = [Kind.grass, Kind.fire, Kind.water, Kind.lava, Kind.ice];

	static get elements(): readonly Element[] { return Catalog.#elements; }
	static get ground(): Kind { return Kind.dirt; }
	static get placeable(): readonly Kind[] { return Catalog.#placeable; }

	static at(kind: Kind): Element {
		return Catalog.#elements[kind];
	}
}
//#endregion

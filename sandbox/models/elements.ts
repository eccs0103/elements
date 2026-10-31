"use strict";

import "adaptive-extender/core";
import { Color, type Random } from "adaptive-extender/core";

//#region Ability
export enum Kind {
	dirt,
	grass,
	fire,
	water,
	lava,
	ice,
}

export enum Reach {
	none = 0,
	orthogonal = 4,
	surrounding = 8,
}

export class Ability {
	#name: string;
	#description: string;
	#preparation: number;
	#reach: Reach;
	#target: Kind | null;
	#product: Kind | null;
	#remains: Kind | null;
	#wear: boolean;
	#renew: boolean;

	constructor(name: string, description: string, preparation: number, reach: Reach, target: Kind | null, product: Kind | null, remains: Kind | null, wear: boolean, renew: boolean) {
		if (!Number.isInteger(preparation) || preparation <= 0) throw new RangeError(`The preparation ${preparation} must be a positive integer`);
		this.#name = name;
		this.#description = description;
		this.#preparation = preparation;
		this.#reach = reach;
		this.#target = target;
		this.#product = product;
		this.#remains = remains;
		this.#wear = wear;
		this.#renew = renew;
	}

	static convert(name: string, description: string, preparation: number, reach: Reach, target: Kind, product: Kind): Ability {
		return new Ability(name, description, preparation, reach, target, product, null, false, false);
	}

	static feed(name: string, description: string, preparation: number, reach: Reach, target: Kind, product: Kind): Ability {
		return new Ability(name, description, preparation, reach, target, product, null, false, true);
	}

	static decay(name: string, description: string, preparation: number, remains: Kind): Ability {
		return new Ability(name, description, preparation, Reach.none, null, null, remains, false, false);
	}

	static react(name: string, description: string, preparation: number, reach: Reach, target: Kind, product: Kind, remains: Kind): Ability {
		return new Ability(name, description, preparation, reach, target, product, remains, false, false);
	}

	static erode(name: string, description: string, preparation: number, reach: Reach, target: Kind, product: Kind, remains: Kind): Ability {
		return new Ability(name, description, preparation, reach, target, product, remains, true, false);
	}

	get name(): string { return this.#name; }
	get description(): string { return this.#description; }
	get preparation(): number { return this.#preparation; }
	get reach(): Reach { return this.#reach; }
	get target(): Kind | null { return this.#target; }
	get product(): Kind | null { return this.#product; }
	get remains(): Kind | null { return this.#remains; }
	get wear(): boolean { return this.#wear; }
	get renew(): boolean { return this.#renew; }
}
//#endregion
//#region Element
export class Element {
	#name: string;
	#color: Readonly<Color>;
	#faded: Readonly<Color>;
	#weight: number;
	#density: number;
	#abilities: readonly Ability[];

	constructor(name: string, color: Readonly<Color>, faded: Readonly<Color>, weight: number, density: number, abilities: readonly Ability[]) {
		this.#name = name;
		this.#color = color;
		this.#faded = faded;
		this.#weight = weight;
		this.#density = density;
		this.#abilities = abilities;
	}

	get name(): string { return this.#name; }
	get color(): Readonly<Color> { return this.#color; }
	get weight(): number { return this.#weight; }
	get density(): number { return this.#density; }
	get abilities(): readonly Ability[] { return this.#abilities; }

	tint(density: number): Color {
		const color = this.#color;
		const maximum = this.#density;
		if (maximum === 0) return new Color(color);
		return Color.mix(this.#faded, color, density / maximum);
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
		new Element("Dirt", Catalog.#dirt, Catalog.#dirt, 90, 0, []),
		new Element("Grass", Catalog.#grass, Catalog.#grass, 4, 0, [
			Ability.convert("Grow", "Grass can expand by converting a random adjacent Dirt element into a Grass element. The ability targets the eight neighboring cells (up, down, left, right, and diagonals) to find a Dirt element and transform it.", 10, Reach.surrounding, Kind.dirt, Kind.grass),
		]),
		new Element("Fire", Catalog.#fire, Catalog.#fire, 2, 0, [
			Ability.feed("Burn", "Fire spreads by converting a random adjacent Grass element into a Fire element. It targets the four neighboring cells (up, down, left, right) to find a Grass element and ignite it. When Fire successfully spreads, it resets the progress of the Fade ability.", 4, Reach.orthogonal, Kind.grass, Kind.fire),
			Ability.decay("Fade", "When Fire burns out, it converts itself into a Dirt element. This ability is triggered when Fire has not spread to a new Grass element after a certain period, indicating the fire has exhausted its fuel and extinguishes itself.", 16, Kind.dirt),
		]),
		new Element("Water", Catalog.#water, Catalog.#water, 2, 0, [
			Ability.convert("Flow", "Water can spread by converting a random adjacent Dirt element into a Water element. This ability targets the eight neighboring cells to find a Dirt element and transform it into Water.", 8, Reach.surrounding, Kind.dirt, Kind.water),
			Ability.react("Evaporate", "Water evaporates when it encounters Fire. This ability converts a random adjacent Fire element and itself into Dirt elements. It targets the four neighboring cells to find a Fire element and then transforms both the Fire and Water into Dirt, simulating the evaporation process.", 8, Reach.orthogonal, Kind.fire, Kind.dirt, Kind.dirt),
		]),
		new Element("Lava", Catalog.#lava, Catalog.#fire, 1, 3, [
			Ability.convert("Flow", "Lava can spread by converting a random adjacent Dirt element into a Lava element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Lava. The new Lava element will have a reduced density compared to the original.", 15, Reach.orthogonal, Kind.dirt, Kind.lava),
			Ability.convert("Burn", "Lava can ignite Grass by converting a random adjacent Grass element into a Fire element. It targets the four neighboring cells to find a Grass element and set it on fire.", 8, Reach.orthogonal, Kind.grass, Kind.fire),
			Ability.erode("Fade", "Lava cools down when it encounters Water. This ability converts a random adjacent Water element into a Dirt element and decreases the Lava's density. It targets the four neighboring cells to find a Water element. If the Lava's density reaches zero, it transforms itself into a Fire element, simulating the cooling process.", 4, Reach.orthogonal, Kind.water, Kind.dirt, Kind.fire),
		]),
		new Element("Ice", Catalog.#ice, Catalog.#water, 1, 3, [
			Ability.convert("Flow", "Ice can spread by converting a random adjacent Dirt element into an Ice element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Ice. The new Ice element will have a reduced density compared to the original.", 12, Reach.orthogonal, Kind.dirt, Kind.ice),
			Ability.erode("Melt", "Ice melts when it encounters Fire. This ability converts a random adjacent Fire element into a Dirt element and decreases the Ice's density. It targets the four neighboring cells to find a Fire element. If the Ice's density reaches zero, it transforms itself into a Water element, simulating the melting process.", 4, Reach.orthogonal, Kind.fire, Kind.dirt, Kind.water),
			Ability.react("Evaporate", "Ice evaporates when it encounters Lava. This ability converts a random adjacent Lava element and itself into Dirt elements. It targets the four neighboring cells to find a Lava element and then transforms both the Lava and Ice into Dirt, simulating the evaporation process.", 4, Reach.orthogonal, Kind.lava, Kind.dirt, Kind.dirt),
		]),
	];

	static #cases: readonly (readonly [Kind, number])[] = Catalog.#elements.map((element, kind) => [kind, element.weight] as const);

	static #total: number = Catalog.#elements.reduce((total, element) => total + element.weight, 0);

	static get elements(): readonly Element[] { return Catalog.#elements; }

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

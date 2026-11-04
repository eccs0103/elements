"use strict";

import "adaptive-extender/core";
import { Color, Deferred, Descendant, Model } from "adaptive-extender/core";

//#region Reaction
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
	#product: ElementType | null;
	#remains: ElementType | null;

	constructor(name: string, description: string, law: Law, interval: number, reach: Reach, target: Selector | null, product: ElementType | null, remains: ElementType | null) {
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

	static ignite(name: string, description: string, interval: number, target: Selector, product: ElementType): Reaction {
		return new Reaction(name, description, Law.ignite, interval, Reach.orthogonal, target, product, null);
	}

	static cool(name: string, description: string, interval: number, target: Selector, product: ElementType, remains: ElementType): Reaction {
		return new Reaction(name, description, Law.cool, interval, Reach.orthogonal, target, product, remains);
	}

	static destroy(name: string, description: string, interval: number, target: Selector, product: ElementType, remains: ElementType): Reaction {
		return new Reaction(name, description, Law.destroy, interval, Reach.orthogonal, target, product, remains);
	}

	static burnout(name: string, description: string, interval: number, remains: ElementType): Reaction {
		return new Reaction(name, description, Law.burnout, interval, Reach.none, null, null, remains);
	}

	get name(): string { return this.#name; }
	get description(): string { return this.#description; }
	get law(): Law { return this.#law; }
	get interval(): number { return this.#interval; }
	get reach(): Reach { return this.#reach; }
	get product(): ElementType | null { return this.#product; }
	get remains(): ElementType | null { return this.#remains; }

	affects(element: Element): boolean {
		return this.#target?.matches(element) ?? false;
	}
}
//#endregion
//#region Element
export interface ElementType {
	new (): Element;
}

export interface ElementTraits {
	name: string;
	color: Readonly<Color>;
	faded: Readonly<Color>;
	phase: Phase;
	heat: number;
	flammable: boolean;
	budget: number;
}

export interface ElementDiscriminator extends DirtDiscriminator, GrassDiscriminator, FireDiscriminator, WaterDiscriminator, LavaDiscriminator, IceDiscriminator {
}

export interface ElementScheme {
	$type: keyof ElementDiscriminator;
}

@Descendant(Deferred(_ => Dirt))
@Descendant(Deferred(_ => Grass))
@Descendant(Deferred(_ => Fire))
@Descendant(Deferred(_ => Water))
@Descendant(Deferred(_ => Lava))
@Descendant(Deferred(_ => Ice))
export abstract class Element extends Model {
	#traits: Readonly<ElementTraits>;
	#reactions: readonly Reaction[];

	constructor();
	constructor(traits: Readonly<ElementTraits>, reactions: readonly Reaction[]);
	constructor(traits?: Readonly<ElementTraits>, reactions?: readonly Reaction[]) {
		if (traits === undefined || reactions === undefined) {
			super();
			return;
		}

		super();
		if (new.target === Element) throw new TypeError("Unable to create an instance of an abstract class");
		this.#traits = traits;
		this.#reactions = reactions;
	}

	get name(): string { return this.#traits.name; }
	get color(): Readonly<Color> { return this.#traits.color; }
	get phase(): Phase { return this.#traits.phase; }
	get heat(): number { return this.#traits.heat; }
	get flammable(): boolean { return this.#traits.flammable; }
	get budget(): number { return this.#traits.budget; }
	get reactions(): readonly Reaction[] { return this.#reactions; }

	is(other: Element): boolean {
		return this.constructor === other.constructor;
	}

	tint(budget: number): Color {
		const { color, faded, budget: maximum } = this.#traits;
		if (maximum === 0) return new Color(color);
		return Color.mix(faded, color, budget / maximum);
	}
}
//#endregion
//#region Dirt
export interface DirtDiscriminator {
	"Dirt": Dirt;
}

export interface DirtScheme extends ElementScheme {
	$type: keyof DirtDiscriminator;
}

export class Dirt extends Element {
	static #color: Readonly<Color> = Color.fromRGB(150, 100, 80);

	constructor() {
		const color = Dirt.#color;
		super({ name: "Dirt", color, faded: color, phase: Phase.powder, heat: 0, flammable: false, budget: 0 }, []);
	}
}
//#endregion
//#region Grass
export interface GrassDiscriminator {
	"Grass": Grass;
}

export interface GrassScheme extends ElementScheme {
	$type: keyof GrassDiscriminator;
}

export class Grass extends Element {
	static #color: Readonly<Color> = Color.fromRGB(0, 128, 0);

	constructor() {
		const color = Grass.#color;
		super({ name: "Grass", color, faded: color, phase: Phase.plant, heat: 0, flammable: true, budget: 0 }, [
			Reaction.spread("Grow", "Grass can expand by converting a random adjacent Dirt element into a Grass element. The ability targets the eight neighboring cells (up, down, left, right, and diagonals) to find a Dirt element and transform it.", 10, Reach.surrounding, Selector.of(Phase.powder, Climate.any)),
		]);
	}
}
//#endregion
//#region Fire
export interface FireDiscriminator {
	"Fire": Fire;
}

export interface FireScheme extends ElementScheme {
	$type: keyof FireDiscriminator;
}

export class Fire extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 150, 0);

	constructor() {
		const color = Fire.#color;
		super({ name: "Fire", color, faded: color, phase: Phase.energy, heat: 2, flammable: false, budget: 0 }, [
			Reaction.ignite("Burn", "Fire spreads by converting a random adjacent Grass element into a Fire element. It targets the four neighboring cells (up, down, left, right) to find a Grass element and ignite it. When Fire successfully spreads, it resets the progress of the Fade ability.", 4, Selector.flammable(), Fire),
			Reaction.burnout("Fade", "When Fire burns out, it converts itself into a Dirt element. This ability is triggered when Fire has not spread to a new Grass element after a certain period, indicating the fire has exhausted its fuel and extinguishes itself.", 16, Dirt),
		]);
	}
}
//#endregion
//#region Water
export interface WaterDiscriminator {
	"Water": Water;
}

export interface WaterScheme extends ElementScheme {
	$type: keyof WaterDiscriminator;
}

export class Water extends Element {
	static #color: Readonly<Color> = Color.fromRGB(0, 50, 255);

	constructor() {
		const color = Water.#color;
		super({ name: "Water", color, faded: color, phase: Phase.liquid, heat: -1, flammable: false, budget: 0 }, [
			Reaction.spread("Flow", "Water can spread by converting a random adjacent Dirt element into a Water element. This ability targets the eight neighboring cells to find a Dirt element and transform it into Water.", 8, Reach.surrounding, Selector.of(Phase.powder, Climate.any)),
			Reaction.destroy("Evaporate", "Water evaporates when it encounters Fire. This ability converts a random adjacent Fire element and itself into Dirt elements. It targets the four neighboring cells to find a Fire element and then transforms both the Fire and Water into Dirt, simulating the evaporation process.", 8, Selector.of(Phase.energy, Climate.hot), Dirt, Dirt),
		]);
	}
}
//#endregion
//#region Lava
export interface LavaDiscriminator {
	"Lava": Lava;
}

export interface LavaScheme extends ElementScheme {
	$type: keyof LavaDiscriminator;
}

export class Lava extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 0, 0);
	static #faded: Readonly<Color> = Color.fromRGB(255, 150, 0);

	constructor() {
		super({ name: "Lava", color: Lava.#color, faded: Lava.#faded, phase: Phase.liquid, heat: 3, flammable: false, budget: 3 }, [
			Reaction.spread("Flow", "Lava can spread by converting a random adjacent Dirt element into a Lava element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Lava. The new Lava element will have a reduced density compared to the original.", 15, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.ignite("Burn", "Lava can ignite Grass by converting a random adjacent Grass element into a Fire element. It targets the four neighboring cells to find a Grass element and set it on fire.", 8, Selector.flammable(), Fire),
			Reaction.cool("Fade", "Lava cools down when it encounters Water. This ability converts a random adjacent Water element into a Dirt element and decreases the Lava's density. It targets the four neighboring cells to find a Water element. If the Lava's density reaches zero, it transforms itself into a Fire element, simulating the cooling process.", 4, Selector.of(Phase.liquid, Climate.cold), Dirt, Fire),
		]);
	}
}
//#endregion
//#region Ice
export interface IceDiscriminator {
	"Ice": Ice;
}

export interface IceScheme extends ElementScheme {
	$type: keyof IceDiscriminator;
}

export class Ice extends Element {
	static #color: Readonly<Color> = Color.fromRGB(0, 200, 255);
	static #faded: Readonly<Color> = Color.fromRGB(0, 50, 255);

	constructor() {
		super({ name: "Ice", color: Ice.#color, faded: Ice.#faded, phase: Phase.solid, heat: -2, flammable: false, budget: 3 }, [
			Reaction.spread("Flow", "Ice can spread by converting a random adjacent Dirt element into an Ice element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Ice. The new Ice element will have a reduced density compared to the original.", 12, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.cool("Melt", "Ice melts when it encounters Fire. This ability converts a random adjacent Fire element into a Dirt element and decreases the Ice's density. It targets the four neighboring cells to find a Fire element. If the Ice's density reaches zero, it transforms itself into a Water element, simulating the melting process.", 4, Selector.of(Phase.energy, Climate.hot), Dirt, Water),
			Reaction.destroy("Evaporate", "Ice evaporates when it encounters Lava. This ability converts a random adjacent Lava element and itself into Dirt elements. It targets the four neighboring cells to find a Lava element and then transforms both the Lava and Ice into Dirt, simulating the evaporation process.", 4, Selector.of(Phase.liquid, Climate.hot), Dirt, Dirt),
		]);
	}
}
//#endregion

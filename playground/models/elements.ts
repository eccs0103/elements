"use strict";

import "adaptive-extender/core";
import { Color, Deferred, Descendant, Model } from "adaptive-extender/core";
import { Climate, Reach, Selector, Reaction } from "./reactions.js";

//#region Element
export enum Phase {
	powder = "powder",
	plant = "plant",
	energy = "energy",
	liquid = "liquid",
	solid = "solid",
	gas = "gas",
}

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
	conductive: boolean;
	budget: number;
}

export interface ElementDiscriminator extends DirtDiscriminator, GrassDiscriminator, FireDiscriminator, WaterDiscriminator, LavaDiscriminator, IceDiscriminator, EmberDiscriminator, MagmaDiscriminator, PlasmaDiscriminator, SteamDiscriminator, GunpowderDiscriminator, SnowDiscriminator, FrostDiscriminator, CryoDiscriminator, CrystalDiscriminator, MudDiscriminator, AcidDiscriminator, OilDiscriminator, BrineDiscriminator, SlimeDiscriminator, SandDiscriminator, StoneDiscriminator, MetalDiscriminator, SaltDiscriminator, GlassDiscriminator, SpongeDiscriminator, RustDiscriminator, VineDiscriminator, MossDiscriminator, MushroomDiscriminator, WoodDiscriminator, BlightDiscriminator, CoralDiscriminator, PollenDiscriminator, SparkDiscriminator, LightningDiscriminator, VoidDiscriminator, WindDiscriminator {
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
@Descendant(Deferred(_ => Ember))
@Descendant(Deferred(_ => Magma))
@Descendant(Deferred(_ => Plasma))
@Descendant(Deferred(_ => Steam))
@Descendant(Deferred(_ => Gunpowder))
@Descendant(Deferred(_ => Snow))
@Descendant(Deferred(_ => Frost))
@Descendant(Deferred(_ => Cryo))
@Descendant(Deferred(_ => Crystal))
@Descendant(Deferred(_ => Mud))
@Descendant(Deferred(_ => Acid))
@Descendant(Deferred(_ => Oil))
@Descendant(Deferred(_ => Brine))
@Descendant(Deferred(_ => Slime))
@Descendant(Deferred(_ => Sand))
@Descendant(Deferred(_ => Stone))
@Descendant(Deferred(_ => Metal))
@Descendant(Deferred(_ => Salt))
@Descendant(Deferred(_ => Glass))
@Descendant(Deferred(_ => Sponge))
@Descendant(Deferred(_ => Rust))
@Descendant(Deferred(_ => Vine))
@Descendant(Deferred(_ => Moss))
@Descendant(Deferred(_ => Mushroom))
@Descendant(Deferred(_ => Wood))
@Descendant(Deferred(_ => Blight))
@Descendant(Deferred(_ => Coral))
@Descendant(Deferred(_ => Pollen))
@Descendant(Deferred(_ => Spark))
@Descendant(Deferred(_ => Lightning))
@Descendant(Deferred(_ => Void))
@Descendant(Deferred(_ => Wind))
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
	get conductive(): boolean { return this.#traits.conductive; }
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
	// Not simplified: every element keeps its colours as named shared statics (owner ruling); inlining them is not a cut.
	static #color: Readonly<Color> = Color.fromRGB(150, 100, 80);

	constructor() {
		const color = Dirt.#color;
		super({ name: "Dirt", color, faded: color, phase: Phase.powder, heat: 0, flammable: false, conductive: false, budget: 0 }, []);
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
		super({ name: "Grass", color, faded: color, phase: Phase.plant, heat: 0, flammable: true, conductive: false, budget: 0 }, [
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
		super({ name: "Fire", color, faded: color, phase: Phase.energy, heat: 2, flammable: false, conductive: false, budget: 0 }, [
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
		super({ name: "Water", color, faded: color, phase: Phase.liquid, heat: -1, flammable: false, conductive: true, budget: 0 }, [
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
		super({ name: "Lava", color: Lava.#color, faded: Lava.#faded, phase: Phase.liquid, heat: 3, flammable: false, conductive: false, budget: 3 }, [
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
		super({ name: "Ice", color: Ice.#color, faded: Ice.#faded, phase: Phase.solid, heat: -2, flammable: false, conductive: false, budget: 3 }, [
			Reaction.spread("Flow", "Ice can spread by converting a random adjacent Dirt element into an Ice element with lower density. This ability targets the four neighboring cells to find a Dirt element and transform it into Ice. The new Ice element will have a reduced density compared to the original.", 12, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.cool("Melt", "Ice melts when it encounters Fire. This ability converts a random adjacent Fire element into a Dirt element and decreases the Ice's density. It targets the four neighboring cells to find a Fire element. If the Ice's density reaches zero, it transforms itself into a Water element, simulating the melting process.", 4, Selector.of(Phase.energy, Climate.hot), Dirt, Water),
			Reaction.destroy("Evaporate", "Ice evaporates when it encounters Lava. This ability converts a random adjacent Lava element and itself into Dirt elements. It targets the four neighboring cells to find a Lava element and then transforms both the Lava and Ice into Dirt, simulating the evaporation process.", 4, Selector.of(Phase.liquid, Climate.hot), Dirt, Dirt),
		]);
	}
}
//#endregion
//#region Ember
export interface EmberDiscriminator {
	"Ember": Ember;
}

export interface EmberScheme extends ElementScheme {
	$type: keyof EmberDiscriminator;
}

export class Ember extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 90, 40);
	static #faded: Readonly<Color> = Color.fromRGB(191, 68, 30);

	constructor() {
		super({ name: "Ember", color: Ember.#color, faded: Ember.#faded, phase: Phase.energy, heat: 1, flammable: false, conductive: false, budget: 8 }, [
			Reaction.spread("Smoulder", "Ember creeps over adjacent Dirt with a lower charge, up to its budget.", 12, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.ignite("Kindle", "Ember sets an adjacent flammable element on fire.", 12, Selector.flammable(), Fire),
			Reaction.convert("Thaw", "Ember smoulders through an adjacent cold solid, turning it into Ember.", 10, Selector.of(Phase.solid, Climate.cold), Ember),
			Reaction.burnout("Fade", "Ember goes out into Dirt after a long time without kindling anything.", 240, Dirt),
		]);
	}
}
//#endregion
//#region Magma
export interface MagmaDiscriminator {
	"Magma": Magma;
}

export interface MagmaScheme extends ElementScheme {
	$type: keyof MagmaDiscriminator;
}

export class Magma extends Element {
	static #color: Readonly<Color> = Color.fromRGB(140, 20, 40);
	static #faded: Readonly<Color> = Color.fromRGB(90, 30, 30);

	constructor() {
		super({ name: "Magma", color: Magma.#color, faded: Magma.#faded, phase: Phase.solid, heat: 3, flammable: false, conductive: false, budget: 9 }, [
			Reaction.spread("Creep", "Magma slowly creeps over adjacent Dirt with a lower charge.", 12, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Melt", "Magma melts an adjacent neutral solid into Lava.", 10, Selector.of(Phase.solid, Climate.mild), Lava),
			Reaction.convert("Thaw", "Magma melts an adjacent cold solid into Lava.", 10, Selector.of(Phase.solid, Climate.cold), Lava),
			Reaction.ignite("Burn", "Magma sets an adjacent flammable element on fire.", 10, Selector.flammable(), Fire),
		]);
	}
}
//#endregion
//#region Plasma
export interface PlasmaDiscriminator {
	"Plasma": Plasma;
}

export interface PlasmaScheme extends ElementScheme {
	$type: keyof PlasmaDiscriminator;
}

export class Plasma extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 80, 255);
	static #faded: Readonly<Color> = Color.fromRGB(160, 40, 200);

	constructor() {
		super({ name: "Plasma", color: Plasma.#color, faded: Plasma.#faded, phase: Phase.energy, heat: 3, flammable: false, conductive: false, budget: 8 }, [
			Reaction.cool("Boil", "Plasma boils an adjacent liquid into Steam and loses charge; when the charge is gone it collapses into Fire.", 5, Selector.of(Phase.liquid, Climate.any), Steam, Fire),
		]);
	}
}
//#endregion
//#region Steam
export interface SteamDiscriminator {
	"Steam": Steam;
}

export interface SteamScheme extends ElementScheme {
	$type: keyof SteamDiscriminator;
}

export class Steam extends Element {
	static #color: Readonly<Color> = Color.fromRGB(215, 165, 190);
	static #faded: Readonly<Color> = Color.fromRGB(161, 124, 143);

	constructor() {
		super({ name: "Steam", color: Steam.#color, faded: Steam.#faded, phase: Phase.gas, heat: 1, flammable: false, conductive: false, budget: 2 }, [
			Reaction.spread("Billow", "Steam billows into any of the eight neighbouring Dirt cells with a lower charge.", 8, Reach.surrounding, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Thaw", "Steam melts an adjacent cold solid into Water.", 10, Selector.of(Phase.solid, Climate.cold), Water),
			Reaction.burnout("Condense", "Steam condenses into Water after a while.", 260, Water),
		]);
	}
}
//#endregion
//#region Gunpowder
export interface GunpowderDiscriminator {
	"Gunpowder": Gunpowder;
}

export interface GunpowderScheme extends ElementScheme {
	$type: keyof GunpowderDiscriminator;
}

export class Gunpowder extends Element {
	static #color: Readonly<Color> = Color.fromRGB(70, 70, 85);
	static #faded: Readonly<Color> = Color.fromRGB(53, 53, 64);

	constructor() {
		super({ name: "Gunpowder", color: Gunpowder.#color, faded: Gunpowder.#faded, phase: Phase.solid, heat: 0, flammable: true, conductive: false, budget: 19 }, [
			Reaction.spread("Pile", "Gunpowder piles onto adjacent Dirt with a lower charge.", 9, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.destroy("Blast", "Gunpowder explodes when anything hot touches it: the hot element and the Gunpowder both turn into Fire.", 2, Selector.any(Climate.hot), Fire, Fire),
		]);
	}
}
//#endregion
//#region Snow
export interface SnowDiscriminator {
	"Snow": Snow;
}

export interface SnowScheme extends ElementScheme {
	$type: keyof SnowDiscriminator;
}

export class Snow extends Element {
	static #color: Readonly<Color> = Color.fromRGB(205, 220, 235);

	constructor() {
		const color = Snow.#color;
		super({ name: "Snow", color, faded: color, phase: Phase.solid, heat: -1, flammable: false, conductive: false, budget: 22 }, [
			Reaction.spread("Drift", "Snow slowly drifts over adjacent Dirt without limit.", 40, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Freeze", "Snow freezes an adjacent cold liquid into Ice.", 14, Selector.of(Phase.liquid, Climate.cold), Ice),
		]);
	}
}
//#endregion
//#region Frost
export interface FrostDiscriminator {
	"Frost": Frost;
}

export interface FrostScheme extends ElementScheme {
	$type: keyof FrostDiscriminator;
}

export class Frost extends Element {
	static #color: Readonly<Color> = Color.fromRGB(150, 220, 240);

	constructor() {
		const color = Frost.#color;
		super({ name: "Frost", color, faded: color, phase: Phase.solid, heat: -2, flammable: false, conductive: false, budget: 0 }, [
			Reaction.spread("Creep", "Frost creeps over an adjacent cold liquid without limit, freezing it into Frost.", 26, Reach.orthogonal, Selector.of(Phase.liquid, Climate.cold)),
			Reaction.convert("Quench", "Frost quenches an adjacent hot liquid or solid into Stone.", 10, Selector.among([Phase.liquid, Phase.solid], Climate.hot), Stone),
		]);
	}
}
//#endregion
//#region Cryo
export interface CryoDiscriminator {
	"Cryo": Cryo;
}

export interface CryoScheme extends ElementScheme {
	$type: keyof CryoDiscriminator;
}

export class Cryo extends Element {
	static #color: Readonly<Color> = Color.fromRGB(60, 255, 230);
	static #faded: Readonly<Color> = Color.fromRGB(45, 191, 173);

	constructor() {
		super({ name: "Cryo", color: Cryo.#color, faded: Cryo.#faded, phase: Phase.energy, heat: -3, flammable: false, conductive: false, budget: 6 }, [
			Reaction.cool("Quench", "Cryo freezes an adjacent hot element into Ice and loses charge; when the charge is gone it turns into Ice.", 4, Selector.any(Climate.hot), Ice, Ice),
			Reaction.burnout("Fade", "Cryo settles into Ice after a short time.", 120, Ice),
		]);
	}
}
//#endregion
//#region Crystal
export interface CrystalDiscriminator {
	"Crystal": Crystal;
}

export interface CrystalScheme extends ElementScheme {
	$type: keyof CrystalDiscriminator;
}

export class Crystal extends Element {
	static #color: Readonly<Color> = Color.fromRGB(180, 140, 255);
	static #faded: Readonly<Color> = Color.fromRGB(130, 100, 200);

	constructor() {
		super({ name: "Crystal", color: Crystal.#color, faded: Crystal.#faded, phase: Phase.solid, heat: -1, flammable: false, conductive: false, budget: 8 }, [
			Reaction.spread("Grow", "Crystal grows over an adjacent cold solid, turning it into Crystal with a lower charge.", 10, Reach.orthogonal, Selector.of(Phase.solid, Climate.cold)),
		]);
	}
}
//#endregion
//#region Mud
export interface MudDiscriminator {
	"Mud": Mud;
}

export interface MudScheme extends ElementScheme {
	$type: keyof MudDiscriminator;
}

export class Mud extends Element {
	static #color: Readonly<Color> = Color.fromRGB(95, 60, 35);

	constructor() {
		const color = Mud.#color;
		super({ name: "Mud", color, faded: color, phase: Phase.liquid, heat: -1, flammable: false, conductive: false, budget: 22 }, [
			Reaction.spread("Seep", "Mud slowly seeps over adjacent Dirt without limit.", 40, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Douse", "Mud douses an adjacent flame into Dirt.", 16, Selector.of(Phase.energy, Climate.hot), Dirt),
		]);
	}
}
//#endregion
//#region Acid
export interface AcidDiscriminator {
	"Acid": Acid;
}

export interface AcidScheme extends ElementScheme {
	$type: keyof AcidDiscriminator;
}

export class Acid extends Element {
	static #color: Readonly<Color> = Color.fromRGB(170, 255, 0);
	static #faded: Readonly<Color> = Color.fromRGB(110, 180, 0);

	constructor() {
		super({ name: "Acid", color: Acid.#color, faded: Acid.#faded, phase: Phase.liquid, heat: 1, flammable: false, conductive: false, budget: 6 }, [
			Reaction.spread("Flow", "Acid flows over adjacent Dirt with a lower charge.", 12, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.cool("Dissolve", "Acid dissolves an adjacent neutral solid or plant into Dirt and loses charge; when the charge is gone it turns into Dirt.", 6, Selector.among([Phase.solid, Phase.plant], Climate.mild), Dirt, Dirt),
		]);
	}
}
//#endregion
//#region Oil
export interface OilDiscriminator {
	"Oil": Oil;
}

export interface OilScheme extends ElementScheme {
	$type: keyof OilDiscriminator;
}

export class Oil extends Element {
	static #color: Readonly<Color> = Color.fromRGB(50, 35, 15);
	static #faded: Readonly<Color> = Color.fromRGB(38, 26, 11);

	constructor() {
		super({ name: "Oil", color: Oil.#color, faded: Oil.#faded, phase: Phase.liquid, heat: 0, flammable: true, conductive: false, budget: 16 }, [
			Reaction.spread("Slick", "Oil spreads over an adjacent cold liquid, covering it with Oil of a lower charge.", 8, Reach.orthogonal, Selector.of(Phase.liquid, Climate.cold)),
		]);
	}
}
//#endregion
//#region Brine
export interface BrineDiscriminator {
	"Brine": Brine;
}

export interface BrineScheme extends ElementScheme {
	$type: keyof BrineDiscriminator;
}

export class Brine extends Element {
	static #color: Readonly<Color> = Color.fromRGB(40, 120, 170);
	static #faded: Readonly<Color> = Color.fromRGB(30, 90, 140);

	constructor() {
		super({ name: "Brine", color: Brine.#color, faded: Brine.#faded, phase: Phase.liquid, heat: -1, flammable: false, conductive: true, budget: 14 }, [
			Reaction.spread("Flow", "Brine flows over adjacent Dirt with a lower charge.", 10, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Melt", "Brine melts an adjacent cold solid into Brine.", 8, Selector.of(Phase.solid, Climate.cold), Brine),
		]);
	}
}
//#endregion
//#region Slime
export interface SlimeDiscriminator {
	"Slime": Slime;
}

export interface SlimeScheme extends ElementScheme {
	$type: keyof SlimeDiscriminator;
}

export class Slime extends Element {
	static #color: Readonly<Color> = Color.fromRGB(140, 200, 90);
	static #faded: Readonly<Color> = Color.fromRGB(100, 150, 70);

	constructor() {
		super({ name: "Slime", color: Slime.#color, faded: Slime.#faded, phase: Phase.liquid, heat: 0, flammable: false, conductive: false, budget: 11 }, [
			Reaction.spread("Engulf", "Slime engulfs an adjacent plant, turning it into Slime with a lower charge.", 9, Reach.orthogonal, Selector.of(Phase.plant, Climate.any)),
			Reaction.spread("Ooze", "Slime oozes over adjacent Dirt with a lower charge.", 12, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
		]);
	}
}
//#endregion
//#region Sand
export interface SandDiscriminator {
	"Sand": Sand;
}

export interface SandScheme extends ElementScheme {
	$type: keyof SandDiscriminator;
}

export class Sand extends Element {
	static #color: Readonly<Color> = Color.fromRGB(230, 200, 120);

	constructor() {
		const color = Sand.#color;
		super({ name: "Sand", color, faded: color, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 22 }, [
			Reaction.spread("Dune", "Sand slowly drifts over adjacent Dirt without limit.", 50, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Smother", "Sand smothers an adjacent flame into Dirt.", 12, Selector.of(Phase.energy, Climate.hot), Dirt),
		]);
	}
}
//#endregion
//#region Stone
export interface StoneDiscriminator {
	"Stone": Stone;
}

export interface StoneScheme extends ElementScheme {
	$type: keyof StoneDiscriminator;
}

export class Stone extends Element {
	static #color: Readonly<Color> = Color.fromRGB(120, 120, 120);
	static #faded: Readonly<Color> = Color.fromRGB(90, 90, 90);

	constructor() {
		super({ name: "Stone", color: Stone.#color, faded: Stone.#faded, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 13 }, [
			Reaction.spread("Build", "Stone builds over adjacent Dirt with a lower charge.", 18, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
		]);
	}
}
//#endregion
//#region Metal
export interface MetalDiscriminator {
	"Metal": Metal;
}

export interface MetalScheme extends ElementScheme {
	$type: keyof MetalDiscriminator;
}

export class Metal extends Element {
	static #color: Readonly<Color> = Color.fromRGB(170, 180, 195);
	static #faded: Readonly<Color> = Color.fromRGB(130, 140, 155);

	constructor() {
		super({ name: "Metal", color: Metal.#color, faded: Metal.#faded, phase: Phase.solid, heat: 0, flammable: false, conductive: true, budget: 15 }, [
			Reaction.spread("Plate", "Metal plates adjacent Dirt with a lower charge.", 10, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Ground", "Metal grounds an adjacent energy element into Dirt.", 6, Selector.of(Phase.energy, Climate.any), Dirt),
		]);
	}
}
//#endregion
//#region Salt
export interface SaltDiscriminator {
	"Salt": Salt;
}

export interface SaltScheme extends ElementScheme {
	$type: keyof SaltDiscriminator;
}

export class Salt extends Element {
	static #color: Readonly<Color> = Color.fromRGB(250, 200, 200);
	static #faded: Readonly<Color> = Color.fromRGB(188, 150, 150);

	constructor() {
		super({ name: "Salt", color: Salt.#color, faded: Salt.#faded, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 5 }, [
			Reaction.spread("Pile", "Salt piles onto adjacent Dirt with a lower charge.", 22, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.cool("Salinate", "Salt turns an adjacent cold liquid into Brine and loses charge; when the charge is gone it dissolves into Brine.", 8, Selector.of(Phase.liquid, Climate.cold), Brine, Brine),
		]);
	}
}
//#endregion
//#region Glass
export interface GlassDiscriminator {
	"Glass": Glass;
}

export interface GlassScheme extends ElementScheme {
	$type: keyof GlassDiscriminator;
}

export class Glass extends Element {
	static #color: Readonly<Color> = Color.fromRGB(120, 230, 200);
	static #faded: Readonly<Color> = Color.fromRGB(90, 173, 150);

	constructor() {
		super({ name: "Glass", color: Glass.#color, faded: Glass.#faded, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 10 }, [
			Reaction.spread("Pane", "Glass quickly forms over adjacent Dirt with a lower charge.", 8, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
		]);
	}
}
//#endregion
//#region Sponge
export interface SpongeDiscriminator {
	"Sponge": Sponge;
}

export interface SpongeScheme extends ElementScheme {
	$type: keyof SpongeDiscriminator;
}

export class Sponge extends Element {
	static #color: Readonly<Color> = Color.fromRGB(230, 210, 40);
	static #faded: Readonly<Color> = Color.fromRGB(190, 170, 30);

	constructor() {
		super({ name: "Sponge", color: Sponge.#color, faded: Sponge.#faded, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 16 }, [
			Reaction.spread("Absorb", "Sponge absorbs an adjacent liquid, turning it into Sponge with a lower charge.", 10, Reach.orthogonal, Selector.of(Phase.liquid, Climate.any)),
		]);
	}
}
//#endregion
//#region Rust
export interface RustDiscriminator {
	"Rust": Rust;
}

export interface RustScheme extends ElementScheme {
	$type: keyof RustDiscriminator;
}

export class Rust extends Element {
	static #color: Readonly<Color> = Color.fromRGB(170, 60, 20);

	constructor() {
		const color = Rust.#color;
		super({ name: "Rust", color, faded: color, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 20 }, [
			Reaction.spread("Corrode", "Rust corrodes an adjacent conductive element into Rust without limit.", 10, Reach.orthogonal, Selector.conductive()),
			Reaction.burnout("Crumble", "Rust crumbles into Dirt after a while.", 260, Dirt),
		]);
	}
}
//#endregion
//#region Vine
export interface VineDiscriminator {
	"Vine": Vine;
}

export interface VineScheme extends ElementScheme {
	$type: keyof VineDiscriminator;
}

export class Vine extends Element {
	static #color: Readonly<Color> = Color.fromRGB(40, 180, 60);
	static #faded: Readonly<Color> = Color.fromRGB(30, 130, 45);

	constructor() {
		super({ name: "Vine", color: Vine.#color, faded: Vine.#faded, phase: Phase.plant, heat: 0, flammable: true, conductive: false, budget: 14 }, [
			Reaction.spread("Creep", "Vine creeps over any of the eight neighbouring plants with a lower charge.", 8, Reach.surrounding, Selector.of(Phase.plant, Climate.any)),
			Reaction.spread("Climb", "Vine climbs over an adjacent neutral solid with a lower charge.", 14, Reach.orthogonal, Selector.of(Phase.solid, Climate.mild)),
		]);
	}
}
//#endregion
//#region Moss
export interface MossDiscriminator {
	"Moss": Moss;
}

export interface MossScheme extends ElementScheme {
	$type: keyof MossDiscriminator;
}

export class Moss extends Element {
	static #color: Readonly<Color> = Color.fromRGB(90, 130, 40);

	constructor() {
		const color = Moss.#color;
		super({ name: "Moss", color, faded: color, phase: Phase.plant, heat: 0, flammable: true, conductive: false, budget: 0 }, [
			Reaction.spread("Grow", "Moss slowly grows over adjacent Dirt without limit.", 14, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.spread("Overgrow", "Moss overgrows an adjacent neutral solid without limit.", 16, Reach.orthogonal, Selector.of(Phase.solid, Climate.mild)),
		]);
	}
}
//#endregion
//#region Mushroom
export interface MushroomDiscriminator {
	"Mushroom": Mushroom;
}

export interface MushroomScheme extends ElementScheme {
	$type: keyof MushroomDiscriminator;
}

export class Mushroom extends Element {
	static #color: Readonly<Color> = Color.fromRGB(200, 120, 160);
	static #faded: Readonly<Color> = Color.fromRGB(150, 90, 120);

	constructor() {
		super({ name: "Mushroom", color: Mushroom.#color, faded: Mushroom.#faded, phase: Phase.plant, heat: 0, flammable: false, conductive: false, budget: 6 }, [
			Reaction.spread("Rot", "Mushroom rots an adjacent flammable element, turning it into Mushroom with a lower charge.", 10, Reach.orthogonal, Selector.flammable()),
		]);
	}
}
//#endregion
//#region Wood
export interface WoodDiscriminator {
	"Wood": Wood;
}

export interface WoodScheme extends ElementScheme {
	$type: keyof WoodDiscriminator;
}

export class Wood extends Element {
	static #color: Readonly<Color> = Color.fromRGB(180, 125, 40);
	static #faded: Readonly<Color> = Color.fromRGB(135, 94, 30);

	constructor() {
		super({ name: "Wood", color: Wood.#color, faded: Wood.#faded, phase: Phase.plant, heat: 0, flammable: true, conductive: false, budget: 16 }, [
			Reaction.spread("Root", "Wood roots into adjacent Dirt with a lower charge.", 16, Reach.orthogonal, Selector.of(Phase.powder, Climate.any)),
			Reaction.spread("Drink", "Wood drinks an adjacent cold liquid, growing into it with a lower charge.", 10, Reach.orthogonal, Selector.of(Phase.liquid, Climate.cold)),
		]);
	}
}
//#endregion
//#region Blight
export interface BlightDiscriminator {
	"Blight": Blight;
}

export interface BlightScheme extends ElementScheme {
	$type: keyof BlightDiscriminator;
}

export class Blight extends Element {
	static #color: Readonly<Color> = Color.fromRGB(120, 60, 140);
	static #faded: Readonly<Color> = Color.fromRGB(90, 45, 105);

	constructor() {
		super({ name: "Blight", color: Blight.#color, faded: Blight.#faded, phase: Phase.plant, heat: 0, flammable: true, conductive: false, budget: 20 }, [
			Reaction.spread("Infect", "Blight infects any of the eight neighbouring plants with a lower charge.", 6, Reach.surrounding, Selector.of(Phase.plant, Climate.any)),
			Reaction.burnout("Wither", "Blight withers into Dirt after a short time.", 90, Dirt),
		]);
	}
}
//#endregion
//#region Coral
export interface CoralDiscriminator {
	"Coral": Coral;
}

export interface CoralScheme extends ElementScheme {
	$type: keyof CoralDiscriminator;
}

export class Coral extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 120, 110);
	static #faded: Readonly<Color> = Color.fromRGB(200, 90, 85);

	constructor() {
		super({ name: "Coral", color: Coral.#color, faded: Coral.#faded, phase: Phase.solid, heat: 0, flammable: false, conductive: false, budget: 18 }, [
			Reaction.spread("Reef", "Coral builds a reef over an adjacent cold liquid with a lower charge.", 14, Reach.orthogonal, Selector.of(Phase.liquid, Climate.cold)),
		]);
	}
}
//#endregion
//#region Pollen
export interface PollenDiscriminator {
	"Pollen": Pollen;
}

export interface PollenScheme extends ElementScheme {
	$type: keyof PollenDiscriminator;
}

export class Pollen extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 250, 150);
	static #faded: Readonly<Color> = Color.fromRGB(220, 210, 110);

	constructor() {
		super({ name: "Pollen", color: Pollen.#color, faded: Pollen.#faded, phase: Phase.gas, heat: 0, flammable: true, conductive: false, budget: 10 }, [
			Reaction.spread("Drift", "Pollen drifts into any of the eight neighbouring Dirt cells with a lower charge.", 3, Reach.surrounding, Selector.of(Phase.powder, Climate.any)),
			Reaction.burnout("Settle", "Pollen settles and sprouts into Grass.", 45, Grass),
		]);
	}
}
//#endregion
//#region Spark
export interface SparkDiscriminator {
	"Spark": Spark;
}

export interface SparkScheme extends ElementScheme {
	$type: keyof SparkDiscriminator;
}

export class Spark extends Element {
	static #color: Readonly<Color> = Color.fromRGB(255, 255, 0);

	constructor() {
		const color = Spark.#color;
		super({ name: "Spark", color, faded: color, phase: Phase.energy, heat: 1, flammable: false, conductive: false, budget: 0 }, [
			Reaction.spread("Arc", "Spark races over an adjacent cold liquid without limit.", 3, Reach.orthogonal, Selector.of(Phase.liquid, Climate.cold)),
			Reaction.ignite("Kindle", "Spark sets an adjacent flammable element on fire.", 6, Selector.flammable(), Fire),
			Reaction.burnout("Fade", "Spark fades into Dirt almost at once.", 36, Dirt),
		]);
	}
}
//#endregion
//#region Lightning
export interface LightningDiscriminator {
	"Lightning": Lightning;
}

export interface LightningScheme extends ElementScheme {
	$type: keyof LightningDiscriminator;
}

export class Lightning extends Element {
	static #color: Readonly<Color> = Color.fromRGB(120, 140, 255);
	static #faded: Readonly<Color> = Color.fromRGB(90, 105, 191);

	constructor() {
		super({ name: "Lightning", color: Lightning.#color, faded: Lightning.#faded, phase: Phase.energy, heat: 2, flammable: false, conductive: false, budget: 7 }, [
			Reaction.spread("Bolt", "Lightning races over an adjacent neutral solid with a lower charge.", 3, Reach.orthogonal, Selector.of(Phase.solid, Climate.mild)),
			Reaction.convert("Shock", "Lightning shocks an adjacent cold liquid into Spark.", 4, Selector.of(Phase.liquid, Climate.cold), Spark),
			Reaction.ignite("Strike", "Lightning sets an adjacent flammable element on fire.", 4, Selector.flammable(), Fire),
			Reaction.burnout("Fuse", "Lightning fuses into Glass almost at once.", 40, Glass),
		]);
	}
}
//#endregion
//#region Void
export interface VoidDiscriminator {
	"Void": Void;
}

export interface VoidScheme extends ElementScheme {
	$type: keyof VoidDiscriminator;
}

export class Void extends Element {
	static #color: Readonly<Color> = Color.fromRGB(25, 0, 50);
	static #faded: Readonly<Color> = Color.fromRGB(60, 30, 90);

	constructor() {
		super({ name: "Void", color: Void.#color, faded: Void.#faded, phase: Phase.energy, heat: 0, flammable: false, conductive: false, budget: 9 }, [
			Reaction.cool("Erase", "Void erases an adjacent element into Dirt and loses charge; when the charge is gone it turns into Dirt.", 6, Selector.among([Phase.plant, Phase.energy, Phase.liquid, Phase.solid, Phase.gas], Climate.any), Dirt, Dirt),
		]);
	}
}
//#endregion
//#region Wind
export interface WindDiscriminator {
	"Wind": Wind;
}

export interface WindScheme extends ElementScheme {
	$type: keyof WindDiscriminator;
}

export class Wind extends Element {
	static #color: Readonly<Color> = Color.fromRGB(200, 255, 150);
	static #faded: Readonly<Color> = Color.fromRGB(150, 191, 113);

	constructor() {
		super({ name: "Wind", color: Wind.#color, faded: Wind.#faded, phase: Phase.gas, heat: 0, flammable: false, conductive: false, budget: 14 }, [
			Reaction.spread("Gust", "Wind gusts into any of the eight neighbouring Dirt cells with a lower charge.", 3, Reach.surrounding, Selector.of(Phase.powder, Climate.any)),
			Reaction.convert("Disperse", "Wind disperses an adjacent gas into Dirt.", 4, Selector.of(Phase.gas, Climate.any), Dirt),
			Reaction.convert("Snuff", "Wind snuffs an adjacent flame into Dirt.", 4, Selector.of(Phase.energy, Climate.hot), Dirt),
			Reaction.burnout("Calm", "Wind calms into Dirt after a short time.", 60, Dirt),
		]);
	}
}
//#endregion

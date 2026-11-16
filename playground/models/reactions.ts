"use strict";

import "adaptive-extender/core";
import { type Element, type ElementType, type Phase } from "./elements.js";

//#region Reaction
export enum Climate {
	any,
	hot,
	cold,
	mild,
}

export enum Law {
	spread,
	ignite,
	cool,
	destroy,
	burnout,
	convert,
}

export enum Reach {
	none = 0,
	orthogonal = 4,
	surrounding = 8,
}

export class Selector {
	#phases: readonly Phase[] | null;
	#climate: Climate;
	#flammable: boolean;
	#conductive: boolean;

	constructor(phases: readonly Phase[] | null, climate: Climate, flammable: boolean, conductive: boolean) {
		this.#phases = phases;
		this.#climate = climate;
		this.#flammable = flammable;
		this.#conductive = conductive;
	}

	static of(phase: Phase, climate: Climate): Selector {
		return new Selector([phase], climate, false, false);
	}

	static among(phases: readonly Phase[], climate: Climate): Selector {
		return new Selector(phases, climate, false, false);
	}

	static any(climate: Climate): Selector {
		return new Selector(null, climate, false, false);
	}

	static flammable(): Selector {
		return new Selector(null, Climate.any, true, false);
	}

	static conductive(): Selector {
		return new Selector(null, Climate.any, false, true);
	}

	matches(element: Element): boolean {
		const phases = this.#phases;
		const climate = this.#climate;
		const { heat } = element;
		if (this.#flammable && !element.flammable) return false;
		if (this.#conductive && !element.conductive) return false;
		if (phases !== null && !phases.includes(element.phase)) return false;
		if (climate === Climate.hot && heat <= 0) return false;
		if (climate === Climate.cold && heat >= 0) return false;
		if (climate === Climate.mild && heat !== 0) return false;
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

	static convert(name: string, description: string, interval: number, target: Selector, product: ElementType): Reaction {
		return new Reaction(name, description, Law.convert, interval, Reach.orthogonal, target, product, null);
	}

	get name(): string { return this.#name; }
	get description(): string { return this.#description; }
	get law(): Law { return this.#law; }
	get interval(): number { return this.#interval; }
	get reach(): Reach { return this.#reach; }
	get remains(): ElementType | null { return this.#remains; }

	yields(): ElementType {
		return ReferenceError.suppress(this.#product, "The reaction has no resulting element");
	}

	leaves(): ElementType {
		return ReferenceError.suppress(this.#remains, "The reaction has no resulting element");
	}

	reaches(actor: Element, other: Element): boolean {
		const target = this.#target;
		if (target === null || !target.matches(other)) return false;
		if (this.#law === Law.spread) return !other.is(actor);
		const product = this.#product;
		return product === null || !(other instanceof product);
	}
}
//#endregion

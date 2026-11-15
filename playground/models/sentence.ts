"use strict";

import "adaptive-extender/core";
import { Law, Reach, type Element, type Reaction } from "./elements.js";
import { PeriodicTable } from "../services/periodic-table.js";

//#region Phrase
export class Phrase {
	static #crowd: number = 8;
	#text: string | null;
	#elements: readonly Element[];

	constructor(text: string | null, elements: readonly Element[]) {
		this.#text = text;
		this.#elements = elements;
	}

	get text(): string | null { return this.#text; }
	get elements(): readonly Element[] { return this.#elements; }
	get compact(): boolean { return this.#elements.length > Phrase.#crowd; }
}
//#endregion
//#region Sentence
export class Sentence {
	#reaction: Reaction;
	#subjects: readonly Element[];
	#phrases: readonly Phrase[];
	#rate: number;

	constructor(reaction: Reaction, subjects: readonly Element[], phrases: readonly Phrase[], rate: number) {
		this.#reaction = reaction;
		this.#subjects = subjects;
		this.#phrases = phrases;
		this.#rate = rate;
	}

	static acts(element: Element, rate: number): Sentence[] {
		const sentences: Sentence[] = [];
		for (const reaction of element.reactions) {
			const targets = PeriodicTable.elements.filter(other => reaction.reaches(element, other));
			sentences.push(new Sentence(reaction, targets, Sentence.#act(element, reaction, targets), rate));
		}
		return sentences;
	}

	static threats(element: Element, rate: number): Sentence[] {
		const sentences: Sentence[] = [];
		for (const other of PeriodicTable.elements) {
			if (other.is(element)) continue;
			for (const reaction of other.reactions) {
				if (!reaction.reaches(other, element)) continue;
				sentences.push(new Sentence(reaction, [other], Sentence.#threat(other, reaction), rate));
			}
		}
		return sentences;
	}

	static stoppers(element: Element, rate: number): Phrase {
		return new Phrase(null, Array.from(new Set(Sentence.threats(element, rate).flatMap(sentence => sentence.subjects))));
	}

	static #act(element: Element, reaction: Reaction, targets: readonly Element[]): Phrase[] {
		const { law } = reaction;
		const product = Sentence.#product.bind(Sentence, reaction);
		const remains = Sentence.#remains.bind(Sentence, reaction);
		switch (law) {
		case Law.spread: return [new Phrase(reaction.reach === Reach.surrounding ? "Grows in all 8 directions into" : "Grows into", targets), new Phrase(Sentence.#reach(element), [])];
		case Law.convert: return [new Phrase("Turns", targets), new Phrase("into", [product()])];
		case Law.ignite: return [new Phrase("Sets", targets), new Phrase("on fire, turning them into", [product()])];
		case Law.cool: return [new Phrase("Turns", targets), new Phrase("into", [product()]), new Phrase(`${element.budget + 1} times, then becomes`, [remains()])];
		case Law.destroy: return [new Phrase("Destroys", targets), new Phrase("into", [product()]), new Phrase("and becomes", [remains()])];
		case Law.burnout: return [new Phrase("Then becomes", [remains()])];
		default: throw new TypeError(`Invalid '${law}' law`);
		}
	}

	static #threat(other: Element, reaction: Reaction): Phrase[] {
		const { law } = reaction;
		const subject = new Phrase(null, [other]);
		const product = Sentence.#product.bind(Sentence, reaction);
		const remains = Sentence.#remains.bind(Sentence, reaction);
		switch (law) {
		case Law.spread: return [subject, new Phrase("grows over it", [])];
		case Law.convert: return [subject, new Phrase("turns it into", [product()])];
		case Law.ignite: return [subject, new Phrase("sets it on fire, turning it into", [product()])];
		case Law.cool: return [subject, new Phrase("turns it into", [product()])];
		case Law.destroy: return [subject, new Phrase("destroys it into", [product()]), new Phrase("and becomes", [remains()])];
		default: throw new TypeError(`Invalid '${law}' law`);
		}
	}

	static #product(reaction: Reaction): Element {
		return PeriodicTable.of(reaction.yields());
	}

	static #remains(reaction: Reaction): Element {
		return PeriodicTable.of(reaction.leaves());
	}

	static #reach(element: Element): string {
		const { budget } = element;
		if (budget === 0) return "without limit";
		return `up to ${budget - 1} cells away`;
	}

	get subjects(): readonly Element[] { return this.#subjects; }
	get phrases(): readonly Phrase[] { return this.#phrases; }
	get summary(): string { return this.#reaction.description; }
	get when(): string {
		const { name, law, interval } = this.#reaction;
		const seconds = Number(((interval + 1) / this.#rate).toFixed(2));
		return `${name} · ${law === Law.burnout ? "after" : "every"} ${seconds} s`;
	}
}
//#endregion

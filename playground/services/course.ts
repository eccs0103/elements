"use strict";

import "adaptive-extender/core";
import { Grass, Fire, Water, type Element, type ElementType } from "../models/elements.js";
import { Rules } from "../models/rules.js";
import { Move } from "../models/move.js";
import { PeriodicTable } from "./periodic-table.js";
import { Match } from "./match.js";
import { type Player } from "./players.js";
import { Ticket, Verdict } from "../../arena/models/protocol.js";

//#region Progress
export enum Progress {
	running = "running",
	passed = "passed",
	failed = "failed",
}
//#endregion
//#region Patch
class Patch {
	#rival: boolean;
	#type: ElementType;
	#x: number;
	#y: number;

	constructor(rival: boolean, type: ElementType, x: number, y: number) {
		this.#rival = rival;
		this.#type = type;
		this.#x = x;
		this.#y = y;
	}

	lay(match: Match): void {
		const { human } = Ticket;
		const side = this.#rival ? Lesson.opponent : human;
		match.place(side, PeriodicTable.of(this.#type), this.#x, this.#y);
	}
}
//#endregion
//#region Cue
class Cue {
	#time: number;
	#type: ElementType;
	#x: number;
	#y: number;

	constructor(time: number, type: ElementType, x: number, y: number) {
		this.#time = time;
		this.#type = type;
		this.#x = x;
		this.#y = y;
	}

	due(match: Match): boolean {
		return match.tick === match.rules.ticks(this.#time);
	}

	move(match: Match, side: number): Move {
		const element = PeriodicTable.of(this.#type);
		const slot = match.cards(side).findIndex(card => card.is(element));
		return new Move(match.tick, side, slot, this.#x, this.#y);
	}
}
//#endregion
//#region Script
class Script implements Player {
	#cues: readonly Cue[];

	constructor(cues: readonly Cue[]) {
		this.#cues = cues;
	}

	act(match: Match, side: number): Move | null {
		const cue = this.#cues.find(cue => cue.due(match));
		if (cue === undefined) return null;
		return cue.move(match, side);
	}
}
//#endregion
//#region Lesson
export interface LessonType {
	new (): Lesson;
}

export abstract class Lesson {
	static #size: number = 21;
	static #seconds: number = 600;
	static #seed: number = 7;
	static #rival: string = "Rival";
	#rules: Rules | null = null;

	constructor() {
		if (new.target === Lesson) throw new TypeError("Unable to create an instance of an abstract class");
	}

	static get rival(): string { return Lesson.#rival; }

	static get opponent(): number {
		const { human } = Ticket;
		const side = Iterator.range(0, Match.count).find(side => side !== human);
		if (side === undefined) throw new RangeError("A lesson needs a rival side");
		return side;
	}

	get rules(): Rules {
		return this.#rules ??= this.#frame();
	}

	get seconds(): number { return Lesson.#seconds; }
	get timed(): boolean { return false; }
	get lit(): boolean { return true; }
	get warmup(): number { return 0; }
	get layout(): readonly Patch[] { return []; }
	get arsenal(): readonly ElementType[] { return this.cards; }
	get cues(): readonly Cue[] { return []; }
	get elements(): readonly Element[] { return this.cards.map(type => PeriodicTable.of(type)); }
	get area(): number { return this.rules.size ** 2; }
	get failure(): string { return "Not this time."; }

	abstract get title(): string;
	abstract get text(): string;
	abstract get moral(): string;
	abstract get cards(): readonly ElementType[];

	#frame(): Rules {
		const rules = new Rules();
		const { length } = this.cards;
		rules.size = Lesson.#size;
		rules.seconds = this.seconds;
		rules.deck = length;
		rules.hand = length;
		return rules;
	}

	start(): Match {
		const { human } = Ticket;
		const { rules, elements } = this;
		const seed = Lesson.#seed;
		const arsenal = this.arsenal.map(type => PeriodicTable.of(type));
		const decks = Iterator.range(0, Match.count).map(side => side === human ? elements : arsenal).toArray();
		const match = new Match(rules, seed, seed, decks, human);
		for (const patch of this.layout) {
			patch.lay(match);
		}
		const players = this.lineup(null);
		const warmup = rules.ticks(this.warmup);
		while (match.tick < warmup) {
			match.advance(players);
		}
		return match;
	}

	lineup(pupil: Player | null): Player[] {
		const { human } = Ticket;
		const script = new Script(this.cues);
		const idle = new Script([]);
		return Iterator.range(0, Match.count).map(side => side === human ? pupil ?? idle : script).toArray();
	}

	abstract judge(match: Match, looked: boolean): Progress;
}
//#endregion
//#region Grass lesson
export class GrassLesson extends Lesson {
	get title(): string { return "Plant Grass"; }
	get text(): string { return `Drag Grass from your hand onto the lit ${this.rules.rows} rows at the bottom: your home. It grows over empty Dirt by itself.`; }
	get moral(): string { return "Every cell you own is a point."; }
	get cards(): readonly ElementType[] { return [Grass]; }

	judge(match: Match, looked: boolean): Progress {
		void looked;
		if (match.score(Ticket.human) * 2 < this.area) return Progress.running;
		return Progress.passed;
	}
}
//#endregion
//#region Fire lesson
export class FireLesson extends Lesson {
	get title(): string { return "Burn the rival"; }
	get text(): string { return `The rival holds the top. Fire burns all Grass it touches, yours too. Drop Fire, then plant Grass on the ashes. A new card is ready every ${this.rules.cooldown} s.`; }
	get moral(): string { return "Fire clears Grass: whoever plants next takes the ground."; }
	get cards(): readonly ElementType[] { return [Fire, Grass]; }
	get warmup(): number { return 3; }
	get layout(): readonly Patch[] { return [new Patch(false, Grass, 10, 19), new Patch(true, Grass, 10, 1)]; }

	judge(match: Match, looked: boolean): Progress {
		void looked;
		const { human } = Ticket;
		const tally = Verdict.of(match);
		if (tally.against(human) > 0 || tally.scores[human] * 2 < this.area) return Progress.running;
		return Progress.passed;
	}
}
//#endregion
//#region Water lesson
export class WaterLesson extends Lesson {
	static #share: number = 0.8;

	get title(): string { return "Put the fire out"; }
	get text(): string { return "The rival set your Grass on fire. Drop Water: it puts Fire out and flows over the burnt Dirt."; }
	get moral(): string { return "Water stops Fire and takes the Dirt it leaves."; }
	get cards(): readonly ElementType[] { return [Water]; }
	get arsenal(): readonly ElementType[] { return [Fire]; }
	get warmup(): number { return 3.3; }
	get layout(): readonly Patch[] { return [new Patch(false, Grass, 10, 19)]; }
	get cues(): readonly Cue[] { return [new Cue(3, Fire, 10, 6)]; }

	judge(match: Match, looked: boolean): Progress {
		void looked;
		const { human } = Ticket;
		const tally = Verdict.of(match);
		if (tally.against(human) > 0 || tally.scores[human] < this.area * WaterLesson.#share) return Progress.running;
		return Progress.passed;
	}
}
//#endregion
//#region Look lesson
export class LookLesson extends Lesson {
	get title(): string { return "Read any cell"; }
	get text(): string { return "Press and hold any cell to read what it is and what it does. Try one on the rival's side."; }
	get moral(): string { return "Press and hold works in every match."; }
	get cards(): readonly ElementType[] { return [Grass]; }
	get warmup(): number { return 3; }
	get layout(): readonly Patch[] { return [new Patch(false, Grass, 10, 19), new Patch(true, Water, 10, 1)]; }

	judge(match: Match, looked: boolean): Progress {
		void match;
		if (!looked) return Progress.running;
		return Progress.passed;
	}
}
//#endregion
//#region Match lesson
export class MatchLesson extends Lesson {
	static #seconds: number = 20;

	get title(): string { return "Win a match"; }
	get text(): string { return `A real ${this.rules.seconds} s match against a scripted rival. Only the cells at the end count, so keep a card for the last seconds.`; }
	get moral(): string { return "You won. Practice is free, Arena counts for Humanity."; }
	get failure(): string { return "The rival had more cells at the end. Keep a card for the last seconds."; }
	get cards(): readonly ElementType[] { return [Grass, Fire, Water]; }
	get seconds(): number { return MatchLesson.#seconds; }
	get timed(): boolean { return true; }
	get lit(): boolean { return false; }
	get cues(): readonly Cue[] { return [new Cue(1, Grass, 10, 1), new Cue(5, Fire, 10, 1), new Cue(9, Grass, 10, 1), new Cue(13, Grass, 10, 1)]; }

	judge(match: Match, looked: boolean): Progress {
		void looked;
		const { human } = Ticket;
		if (!match.finished) return Progress.running;
		if (Verdict.of(match).winner(human) !== human) return Progress.failed;
		return Progress.passed;
	}
}
//#endregion
//#region Course
export class Course {
	static #types: readonly LessonType[] = [GrassLesson, FireLesson, WaterLesson, LookLesson, MatchLesson];

	static get length(): number { return Course.#types.length; }

	static lesson(index: number): Lesson {
		const types = Course.#types;
		if (!Number.isInteger(index) || index < 0 || index >= types.length) throw new RangeError(`The lesson ${index} does not exist`);
		return new types[index]();
	}

	static index(lesson: Lesson): number {
		const index = Course.#types.findIndex(type => lesson instanceof type);
		if (index < 0) throw new TypeError("The lesson is not in the course");
		return index;
	}
}
//#endregion

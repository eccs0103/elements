"use strict";

import "adaptive-extender/node";
import { describe, expect, it } from "vitest";
import { Course, Progress, type Lesson } from "../playground/services/course.js";
import { Fire, Grass, Water, type ElementType } from "../playground/models/elements.js";
import { Move } from "../playground/models/move.js";
import { type Match } from "../playground/services/match.js";
import { type Player } from "../playground/services/players.js";
import { PeriodicTable } from "../playground/services/periodic-table.js";
import { Ticket, Verdict } from "../arena/models/protocol.js";

//#region Drop
class Drop {
	#time: number;
	#type: ElementType;

	constructor(time: number, type: ElementType) {
		this.#time = time;
		this.#type = type;
	}

	get time(): number { return this.#time; }
	get type(): ElementType { return this.#type; }
}
//#endregion
//#region Pupil
class Pupil implements Player {
	static #x: number = 10;
	static #y: number = 19;
	#drops: readonly Drop[];
	#start: number;

	constructor(drops: readonly Drop[], start: number) {
		this.#drops = drops;
		this.#start = start;
	}

	static move(match: Match, side: number, type: ElementType): Move {
		const element = PeriodicTable.of(type);
		const slot = match.cards(side).findIndex(card => card.is(element));
		return new Move(match.tick, side, slot, Pupil.#x, Pupil.#y);
	}

	act(match: Match, side: number): Move | null {
		const { rules, tick } = match;
		const start = this.#start;
		const drop = this.#drops.find(drop => start + rules.ticks(drop.time) === tick);
		if (drop === undefined) return null;
		return Pupil.move(match, side, drop.type);
	}
}
//#endregion
//#region Responder
class Responder implements Player {
	static #fire: number = PeriodicTable.id(PeriodicTable.of(Fire));
	#reaction: number;
	#wait: number | null = null;

	constructor(reaction: number) {
		this.#reaction = reaction;
	}

	act(match: Match, side: number): Move | null {
		if (!match.ready(side)) return null;
		const wait = this.#wait ?? match.rules.ticks(this.#reaction);
		if (wait > 0) {
			this.#wait = wait - 1;
			return null;
		}
		this.#wait = null;
		const burning = Array.from(match.board.kinds).includes(Responder.#fire);
		if (burning) return Pupil.move(match, side, Water);
		if (match.score(side) < Verdict.of(match).against(side)) return Pupil.move(match, side, Fire);
		return Pupil.move(match, side, Grass);
	}
}
//#endregion
//#region Course
describe("Course", () => {
	const limit = 60;

	const run = (lesson: Lesson, pupil: Player | null, looked: boolean): Progress => {
		const match = lesson.start();
		const players = lesson.lineup(pupil);
		const end = match.tick + match.rules.ticks(limit);
		let progress = Progress.running;
		while (progress === Progress.running && !match.finished && match.tick < end) {
			match.advance(players);
			progress = lesson.judge(match, looked);
		}
		return progress;
	};

	const solve = (index: number, drops: readonly Drop[]): Progress => {
		const lesson = Course.lesson(index);
		return run(lesson, new Pupil(drops, lesson.rules.ticks(lesson.warmup)), false);
	};

	it("starts every lesson with the human on the favoured side", () => {
		for (let index = 0; index < Course.length; index++) {
			expect(Course.lesson(index).start().favoured).toBe(Ticket.human);
			expect(Course.index(Course.lesson(index))).toBe(index);
		}
	});

	it("opens every rival lesson on the position its text describes", () => {
		const { human } = Ticket;
		for (const index of [1, 2, 3]) {
			const tally = Verdict.of(Course.lesson(index).start());
			expect(tally.scores[human]).toBeGreaterThan(0);
			expect(tally.against(human)).toBeGreaterThan(0);
		}
	});

	it("passes the Grass lesson after one drop and never without one", () => {
		expect(solve(0, [new Drop(0.5, Grass)])).toBe(Progress.passed);
		expect(solve(0, [])).toBe(Progress.running);
	});

	it("passes the Fire lesson with Fire then Grass, and never with Grass alone", () => {
		expect(solve(1, [new Drop(0.5, Fire), new Drop(3.6, Grass)])).toBe(Progress.passed);
		expect(solve(1, [new Drop(0.5, Grass)])).toBe(Progress.running);
	});

	it("passes the Water lesson with a quick or a late drop, and never without one", () => {
		expect(solve(2, [new Drop(0.5, Water)])).toBe(Progress.passed);
		expect(solve(2, [new Drop(3, Water)])).toBe(Progress.passed);
		expect(solve(2, [new Drop(8, Water)])).toBe(Progress.passed);
		expect(solve(2, [])).toBe(Progress.running);
	});

	it("passes the look lesson only once a cell is read", () => {
		expect(run(Course.lesson(3), null, true)).toBe(Progress.passed);
		expect(run(Course.lesson(3), null, false)).toBe(Progress.running);
	});

	it("lets an active player win the match lesson, and an idle or drop-once one lose it", () => {
		for (const reaction of [0.8, 1.5, 2.5]) {
			expect(run(Course.lesson(4), new Responder(reaction), false)).toBe(Progress.passed);
		}
		expect(run(Course.lesson(4), null, false)).toBe(Progress.failed);
		const lesson = Course.lesson(4);
		expect(run(lesson, new Pupil([new Drop(0, Grass)], 0), false)).toBe(Progress.failed);
	});
});
//#endregion

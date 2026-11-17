"use strict";

import "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { Schedule, Game, Summary, History, Verdict } from "../arena/models/protocol.js";

describe("Schedule", () => {
	const minute = 60000;

	it("expects the next cron slot before the first run", () => {
		const schedule = new Schedule([]);
		expect(schedule.next).toBeNull();
		expect(schedule.eta(61 * minute)).toBe(75 * minute);
		expect(schedule.eta(75 * minute)).toBe(90 * minute);
	});

	it("expects the cron period after a single run", () => {
		const schedule = new Schedule([100 * minute]);
		expect(schedule.next).toBe(115 * minute);
		expect(schedule.eta(114 * minute)).toBe(115 * minute);
		expect(schedule.eta(115 * minute)).toBeNull();
	});

	it("expects the measured gap when GitHub runs late", () => {
		const schedule = new Schedule([0, 20 * minute, 60 * minute, 90 * minute]);
		expect(schedule.next).toBe(120 * minute);
	});
});

describe("Game", () => {
	const area = 41 ** 2;

	it("shows the browser result until the verifier judges it", () => {
		const game = new Game("id", "Falcon s1", 0, area, 0, true, null, null);
		expect([game.reviewed, game.outcome]).toEqual([false, true]);
	});

	it("is confirmed only when the verdict equals the browser result", () => {
		const confirmed = new Game("id", "Falcon s1", 0, area, 0, true, true, new Verdict([800, 300]));
		const rejected = new Game("id", "Falcon s1", 0, area, 0, true, false, null);
		expect([confirmed.confirmed, confirmed.outcome]).toEqual([true, true]);
		expect([rejected.confirmed, rejected.outcome]).toEqual([false, false]);
	});

	it("counts a match left before the end as a loss", () => {
		const waiting = new Game("id", "Falcon s1", 0, area, 0, null, null, null);
		const judged = new Game("id", "Falcon s1", 0, area, 0, null, false, null);
		expect([waiting.left, waiting.confirmed, waiting.outcome]).toEqual([true, false, false]);
		expect([judged.left, judged.confirmed, judged.outcome]).toEqual([true, false, false]);
	});

	it("crosses the wire unchanged", () => {
		const games = [new Game("id", "Falcon s1", 0, area, 5, true, null, null), new Game("id2", "Falcon s1", 0, area, 6, false, false, new Verdict([300, 800]))];
		const history = new History(games, new Schedule([1, 2]), new Summary(1, 2, 1));
		const copy = History.import(JSON.parse(JSON.stringify(History.export(history))), "history");
		expect(History.export(copy)).toEqual(History.export(history));
	});
});

describe("Verdict", () => {
	it("gives each side's share of the board in percent", () => {
		const verdict = new Verdict([841, 420]);
		expect([verdict.percent(0, 1681), verdict.rival(0, 1681)]).toEqual([50, 25]);
	});
});

describe("Summary", () => {
	it("has no win rate before the first judged match", () => {
		expect(new Summary().rate).toBeNull();
	});

	it("rounds the win rate", () => {
		expect(new Summary(2, 1, 0).rate).toBe(67);
	});
});

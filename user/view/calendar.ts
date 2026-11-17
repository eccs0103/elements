"use strict";

import "adaptive-extender/web";
import { type Game } from "../../arena/models/protocol.js";

const { round, ceil } = Math;

//#region Day
export class Day {
	#label: string;
	#games: Game[];

	constructor(label: string, games: Game[]) {
		this.#label = label;
		this.#games = games;
	}

	get label(): string { return this.#label; }
	get games(): readonly Game[] { return this.#games; }

	static group(games: Iterable<Game>, now: number): Day[] {
		const days: Day[] = [];
		for (const game of games) {
			const label = Calendar.day(game.started, now);
			const last = days.at(-1);
			if (last !== undefined && last.#label === label) {
				last.#games.push(game);
				continue;
			}
			days.push(new Day(label, [game]));
		}
		return days;
	}
}
//#endregion
//#region Calendar
export class Calendar {
	static #day: number = 86400000;
	static #minute: number = 60000;
	static #relative: Intl.RelativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	static #date: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
	static #clock: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

	static day(time: number, now: number): string {
		const days = round((Calendar.#midnight(time) - Calendar.#midnight(now)) / Calendar.#day);
		if (days > -2) return Calendar.#relative.format(days, "day");
		return Calendar.#date.format(time);
	}

	static clock(time: number): string {
		return Calendar.#clock.format(time);
	}

	static until(time: number, now: number): string {
		return Calendar.#relative.format(ceil((time - now) / Calendar.#minute), "minute");
	}

	static #midnight(time: number): number {
		const date = new Date(time);
		date.setHours(0, 0, 0, 0);
		return date.valueOf();
	}
}
//#endregion

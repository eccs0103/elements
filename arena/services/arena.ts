"use strict";

import "adaptive-extender/core";
import { Random } from "adaptive-extender/core";
import { Rules } from "../../playground/models/rules.js";
import { Human } from "../../playground/services/players.js";
import { Ticket, Verdict, Standing, type Report } from "../models/protocol.js";

const random = Random.global;

//#region Arena
export interface Ledger {
	save(ticket: Ticket): Promise<void>;
	take(id: string): Promise<Ticket | null>;
	standing(): Promise<Standing>;
	record(standing: Standing): Promise<void>;
}

export class Arena {
	static #seeds: number = 0x7FFFFFFF;
	static #human: number = 0;
	#ledger: Ledger;

	constructor(ledger: Ledger) {
		this.#ledger = ledger;
	}

	async open(): Promise<Ticket> {
		const seeds = Arena.#seeds;
		const id = `${random.integer(seeds).toString(36)}${random.integer(seeds).toString(36)}`;
		const ticket = new Ticket(id, random.integer(seeds), new Rules(), Arena.#human);
		await this.#ledger.save(ticket);
		return ticket;
	}

	async judge(report: Report): Promise<Verdict> {
		const ledger = this.#ledger;
		const ticket = await ledger.take(report.ticket);
		if (ticket === null) throw new ReferenceError(`The ticket '${report.ticket}' is unknown or already judged`);
		const verdict = Arena.#replay(ticket, report);
		const standing = await ledger.standing();
		standing.count(verdict, ticket.human);
		await ledger.record(standing);
		return verdict;
	}

	async standing(): Promise<Standing> {
		return await this.#ledger.standing();
	}

	static #replay(ticket: Ticket, report: Report): Verdict {
		const { human } = ticket;
		const { moves } = report;
		if (moves.some(move => move.side !== human)) throw new TypeError("The report holds moves of a side that is not human");
		const match = ticket.match();
		const players = ticket.lineup(match, new Human());
		let index = 0;
		while (!match.finished) {
			while (index < moves.length && moves[index].tick === match.tick) {
				const move = moves[index++];
				if (!match.play(move)) throw new TypeError(`The move at tick ${move.tick} is illegal`);
			}
			match.advance(players);
		}
		if (index !== moves.length) throw new TypeError(`Only ${index} of ${moves.length} reported moves fit the match`);
		return Verdict.of(match);
	}
}
//#endregion

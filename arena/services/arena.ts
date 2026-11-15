"use strict";

import "adaptive-extender/core";
import { type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { Ticket, type Entry, type Start, type Report, type Standing } from "../models/protocol.js";
import { type Bucket } from "../models/bucket.js";
import { type Visitor } from "../models/visitor.js";
import { Referee } from "./referee.js";

const { ceil } = Math;

//#region Shortage
export class Shortage extends Error {
	static #minute: number = 60000;

	constructor(wait: number) {
		super(`No matches left. The next one comes in ${ceil(wait / Shortage.#minute)} min.`);
	}
}
//#endregion
//#region Arena
export interface Gate {
	admit(token: string, address: string): Promise<void>;
}

export interface Ledger {
	pending(user: string, since: number): Promise<Ticket | null>;
	renew(ticket: Ticket): Promise<void>;
	take(bucket: Bucket, now: number): Promise<boolean>;
	refund(bucket: Bucket): Promise<void>;
	wait(bucket: Bucket, now: number): Promise<number>;
	save(ticket: Ticket, user: string, now: number): Promise<void>;
	start(id: string, user: string, since: number, now: number): Promise<Ticket | null>;
	report(report: Report, user: string, since: number, now: number): Promise<boolean>;
	standing(): Promise<Standing>;
}

export class Arena {
	static #human: number = 0;
	static #model: string = "Proxima";
	#ledger: Ledger;
	#gate: Gate;

	constructor(ledger: Ledger, gate: Gate) {
		this.#ledger = ledger;
		this.#gate = gate;
	}

	async open(entry: Entry, visitor: Visitor, now: number): Promise<Ticket> {
		const ledger = this.#ledger;
		const pending = await ledger.pending(visitor.user, now - Referee.idle);
		if (pending !== null) return await this.#renew(pending, entry.deck);
		const ticket = new Ticket(crypto.randomUUID(), Arena.#number(), Arena.#number(), new Rules(), Arena.#human, entry.deck, Arena.#model);
		ticket.match();
		await this.#gate.admit(entry.token, visitor.address);
		const taken: Bucket[] = [];
		for (const bucket of visitor.buckets()) {
			if (await ledger.take(bucket, now)) {
				taken.push(bucket);
				continue;
			}
			for (const paid of taken) {
				await ledger.refund(paid);
			}
			throw new Shortage(await ledger.wait(bucket, now));
		}
		await ledger.save(ticket, visitor.user, now);
		return ticket.sealed();
	}

	async start(start: Start, visitor: Visitor, now: number): Promise<Ticket> {
		const ticket = await this.#ledger.start(start.ticket, visitor.user, now - Referee.idle, now);
		if (ticket === null) throw new ReferenceError("The ticket is unknown, expired or already started");
		return ticket;
	}

	async report(report: Report, visitor: Visitor, now: number): Promise<Standing> {
		const ledger = this.#ledger;
		const rules = new Rules();
		const { moves } = report;
		if (moves.length > rules.length / rules.pause + 1) throw new RangeError(`The report holds ${moves.length} moves, more than a match allows`);
		if (moves.some(move => move.side !== Arena.#human)) throw new TypeError("The report holds moves of a side that is not human");
		const since = now - Referee.deadline;
		if (!await ledger.report(report, visitor.user, since, now)) throw new ReferenceError("The match is unknown, not started, too late or already reported");
		return await ledger.standing();
	}

	async standing(): Promise<Standing> {
		return await this.#ledger.standing();
	}

	async #renew(pending: Ticket, deck: Element[]): Promise<Ticket> {
		if (Arena.#same(pending.deck, deck)) return pending.sealed();
		const { id, seed, luck, rules, human, model } = pending;
		const ticket = new Ticket(id, seed, luck, rules, human, deck, model);
		ticket.match();
		await this.#ledger.renew(ticket);
		return ticket.sealed();
	}

	static #same(deck: readonly Element[], other: readonly Element[]): boolean {
		return deck.length === other.length && deck.every((element, index) => element.is(other[index]));
	}

	static #number(): number {
		const [value] = crypto.getRandomValues(new Uint32Array(1));
		return value >>> 1;
	}
}
//#endregion

"use strict";

import "adaptive-extender/core";
import { type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { Ticket, Shortage, History, type Entry, type Start, type Report, type Standing, type Allowance, type Game, type Schedule, type Summary } from "../models/protocol.js";
import { type Bucket } from "../models/bucket.js";
import { type Visitor } from "../models/visitor.js";
import { type AgentModel } from "../../playground/models/agent-catalog.js";

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
	allowance(bucket: Bucket, now: number): Promise<Allowance>;
	save(ticket: Ticket, user: string, now: number): Promise<void>;
	opened(id: string, user: string, since: number): Promise<Ticket | null>;
	start(ticket: Ticket, user: string, since: number, now: number): Promise<boolean>;
	report(report: Report, user: string, since: number, now: number): Promise<boolean>;
	standing(): Promise<Standing>;
	games(user: string, since: number, limit: number): Promise<Game[]>;
	summary(user: string, since: number): Promise<Summary>;
	schedule(): Promise<Schedule>;
}

export class Arena {
	static #unknown: string = "The ticket is unknown, expired or already started";
	static #shown: number = 50;
	#ledger: Ledger;
	#gate: Gate;

	constructor(ledger: Ledger, gate: Gate) {
		this.#ledger = ledger;
		this.#gate = gate;
	}

	async open(entry: Entry, visitor: Visitor, model: AgentModel, now: number): Promise<Ticket> {
		const ledger = this.#ledger;
		const pending = await ledger.pending(visitor.user, now - Ticket.idle);
		if (pending !== null) return await this.#renew(pending, entry.deck);
		const allowance = await this.allowance(visitor, now);
		if (allowance.left < 1) throw Shortage.after(allowance.wait);
		await this.#gate.admit(entry.token, visitor.address);
		const ticket = Ticket.deal(crypto.randomUUID(), Arena.#number(), null, entry.deck, model);
		await ledger.save(ticket, visitor.user, now);
		return ticket.sealed();
	}

	async start(start: Start, visitor: Visitor, now: number): Promise<Ticket> {
		const ledger = this.#ledger;
		const { user } = visitor;
		const since = now - Ticket.idle;
		const unknown = Arena.#unknown;
		start.check();
		const opened = ReferenceError.suppress(await ledger.opened(start.ticket, user, since), unknown);
		const ticket = opened.dealt(start.luck);
		ticket.match();
		const taken = await this.#spend(visitor, now);
		if (await ledger.start(ticket, user, since, now)) return ticket;
		// Not simplified: #spend refunds with the same loop, but a shared method costs as many instructions as it saves.
		for (const bucket of taken) {
			await ledger.refund(bucket);
		}
		throw new ReferenceError(unknown);
	}

	async report(report: Report, visitor: Visitor, now: number): Promise<Standing> {
		const ledger = this.#ledger;
		report.check(new Rules(), Ticket.human);
		const since = now - Ticket.deadline;
		if (!await ledger.report(report, visitor.user, since, now)) throw new ReferenceError("The match is unknown, not started, too late or already reported");
		return await ledger.standing();
	}

	async standing(): Promise<Standing> {
		return await this.#ledger.standing();
	}

	async history(visitor: Visitor, now: number): Promise<History> {
		const ledger = this.#ledger;
		const { user } = visitor;
		const since = now - Ticket.deadline;
		const [games, schedule, summary] = await Promise.all([ledger.games(user, since, Arena.#shown), ledger.schedule(), ledger.summary(user, since)]);
		return new History(games, schedule, summary);
	}

	async allowance(visitor: Visitor, now: number): Promise<Allowance> {
		const ledger = this.#ledger;
		const [first, ...rest] = await Promise.all(visitor.buckets().map(bucket => ledger.allowance(bucket, now)));
		// Not simplified: a reduce gives the same minimum, but with as many instructions as this loop.
		let tightest = first;
		for (const allowance of rest) {
			if (allowance.left < tightest.left) tightest = allowance;
		}
		return tightest;
	}

	async #spend(visitor: Visitor, now: number): Promise<Bucket[]> {
		const ledger = this.#ledger;
		const taken: Bucket[] = [];
		for (const bucket of visitor.buckets()) {
			if (await ledger.take(bucket, now)) {
				taken.push(bucket);
				continue;
			}
			for (const paid of taken) {
				await ledger.refund(paid);
			}
			throw Shortage.after(await ledger.wait(bucket, now));
		}
		return taken;
	}

	async #renew(pending: Ticket, deck: Element[]): Promise<Ticket> {
		if (pending.holds(deck)) return pending.sealed();
		const ticket = pending.redeal(deck);
		await this.#ledger.renew(ticket);
		return ticket.sealed();
	}

	// Not simplified: Duel.#number is the same, but crypto is not in core, so no core model can own one shared copy.
	static #number(): number {
		const [value] = crypto.getRandomValues(new Uint32Array(1));
		return value >>> 1;
	}
}
//#endregion

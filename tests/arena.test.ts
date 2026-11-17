"use strict";

import "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { Rules } from "../playground/models/rules.js";
import { AgentModel } from "../playground/models/agent-catalog.js";
import { Ticket, Entry, Start, Standing, Shortage, Schedule, Summary, type Report, type Allowance, type Game } from "../arena/models/protocol.js";
import { type Bucket } from "../arena/models/bucket.js";
import { Visitor } from "../arena/models/visitor.js";
import { Arena, type Gate, type Ledger } from "../arena/services/arena.js";

const { min, trunc } = Math;

//#region Memory ledger
class TicketRow {
	ticket: Ticket;
	user: string;
	issued: number;
	started: number | null = null;

	constructor(ticket: Ticket, user: string, issued: number) {
		this.ticket = ticket;
		this.user = user;
		this.issued = issued;
	}
}

class BucketRow {
	tokens: number;
	updated: number;

	constructor(tokens: number, updated: number) {
		this.tokens = tokens;
		this.updated = updated;
	}
}

class MemoryLedger implements Ledger {
	#tickets: Map<string, TicketRow> = new Map<string, TicketRow>();
	#buckets: Map<string, BucketRow> = new Map<string, BucketRow>();

	async pending(user: string, since: number): Promise<Ticket | null> {
		let latest: TicketRow | null = null;
		for (const row of this.#tickets.values()) {
			if (row.user !== user || row.started !== null || row.issued <= since) continue;
			if (latest === null || row.issued > latest.issued) latest = row;
		}
		return latest?.ticket ?? null;
	}

	async renew(ticket: Ticket): Promise<void> {
		const row = this.#tickets.get(ticket.id);
		if (row === undefined || row.started !== null) return;
		row.ticket = ticket;
	}

	async take(bucket: Bucket, now: number): Promise<boolean> {
		const { key, capacity, period } = bucket;
		const buckets = this.#buckets;
		const row = buckets.get(key) ?? new BucketRow(capacity, now);
		buckets.set(key, row);
		const refill = trunc((now - row.updated) / period);
		const tokens = row.tokens + refill;
		if (tokens < 1) return false;
		row.updated = tokens >= capacity ? now : row.updated + refill * period;
		row.tokens = min(capacity, tokens) - 1;
		return true;
	}

	async refund(bucket: Bucket): Promise<void> {
		const row = this.#buckets.get(bucket.key);
		if (row === undefined) return;
		row.tokens = min(bucket.capacity, row.tokens + 1);
	}

	async wait(bucket: Bucket, now: number): Promise<number> {
		const row = ReferenceError.suppress(this.#buckets.get(bucket.key), `The bucket '${bucket.key}' is missing`);
		return bucket.wait(row.updated, now);
	}

	async allowance(bucket: Bucket, now: number): Promise<Allowance> {
		const row = this.#buckets.get(bucket.key);
		if (row === undefined) return bucket.full();
		return bucket.allowance(row.tokens, row.updated, now);
	}

	async save(ticket: Ticket, user: string, now: number): Promise<void> {
		this.#tickets.set(ticket.id, new TicketRow(ticket, user, now));
	}

	async opened(id: string, user: string, since: number): Promise<Ticket | null> {
		const row = this.#tickets.get(id);
		if (row === undefined || row.user !== user || row.started !== null || row.issued <= since) return null;
		return row.ticket;
	}

	async start(ticket: Ticket, user: string, since: number, now: number): Promise<boolean> {
		const row = this.#tickets.get(ticket.id);
		if (row === undefined || row.user !== user || row.started !== null || row.issued <= since) return false;
		row.ticket = ticket;
		row.started = now;
		return true;
	}

	async report(report: Report, user: string, since: number, now: number): Promise<boolean> {
		void report, user, since, now;
		return false;
	}

	async standing(): Promise<Standing> {
		return new Standing();
	}

	async games(user: string, since: number, limit: number): Promise<Game[]> {
		void user, since, limit;
		return [];
	}

	async summary(user: string, since: number): Promise<Summary> {
		void user, since;
		return new Summary();
	}

	async schedule(): Promise<Schedule> {
		return new Schedule([]);
	}
}
//#endregion
//#region Open gate
class OpenGate implements Gate {
	async admit(token: string, address: string): Promise<void> {
		void token, address;
	}
}
//#endregion

describe("Arena", () => {
	const visitor = new Visitor("visitor", "192.0.2.1");
	const model = new AgentModel("data/test", "Test", "A test model.", 0.6, "0".repeat(64));
	const entry = new Entry(Ticket.draft(new Rules(), 1, Ticket.human).elements, "token");

	it("spends a ticket only when a match starts, with the page's luck", async () => {
		const arena = new Arena(new MemoryLedger(), new OpenGate());
		const now = 1000000;
		const lobby = await arena.open(entry, visitor, model, now);
		expect(lobby.seed).toBeNull();
		expect(lobby.luck).toBeNull();
		const unspent = await arena.allowance(visitor, now);
		expect([unspent.left, unspent.capacity]).toEqual([3, 3]);
		const reopened = await arena.open(entry, visitor, model, now + 1);
		expect(reopened.id).toBe(lobby.id);
		const started = await arena.start(new Start(lobby.id, 12345), visitor, now + 2);
		expect(started.luck).toBe(12345);
		expect(started.seed).not.toBeNull();
		const spent = await arena.allowance(visitor, now + 2);
		expect([spent.left, spent.capacity]).toEqual([2, 3]);
		await expect(arena.start(new Start(lobby.id, 12345), visitor, now + 3)).rejects.toThrow(ReferenceError);
		const reloaded = await arena.open(entry, visitor, model, now + 4);
		expect(reloaded.id).not.toBe(lobby.id);
		const kept = await arena.allowance(visitor, now + 4);
		expect(kept.left).toBe(2);
		for (let index = 0; index < 2; index++) {
			const next = await arena.open(entry, visitor, model, now + 10 + index);
			await arena.start(new Start(next.id, index), visitor, now + 10 + index);
		}
		const empty = await arena.allowance(visitor, now + 20);
		expect(empty.left).toBe(0);
		await expect(arena.open(entry, visitor, model, now + 21)).rejects.toThrow(Shortage);
	});

	it("refuses a luck outside the dealt range", async () => {
		const arena = new Arena(new MemoryLedger(), new OpenGate());
		const lobby = await arena.open(entry, visitor, model, 0);
		await expect(arena.start(new Start(lobby.id, -1), visitor, 1)).rejects.toThrow(RangeError);
		await expect(arena.start(new Start(lobby.id, 0.5), visitor, 1)).rejects.toThrow(RangeError);
	});
});

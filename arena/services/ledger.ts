"use strict";

import "adaptive-extender/core";
import { Move } from "../../playground/models/move.js";
import { Ticket, Report, Standing, type Allowance } from "../models/protocol.js";
import { type Bucket } from "../models/bucket.js";
import { type Ledger } from "./arena.js";

//#region D1 ledger
interface BucketRow {
	tokens: number;
	updated: number;
}

export class D1Ledger implements Ledger {
	#database: D1Database;

	constructor(database: D1Database) {
		this.#database = database;
	}

	async pending(user: string, since: number): Promise<Ticket | null> {
		const row = await this.#database.prepare("SELECT ticket FROM tickets WHERE visitor = ?1 AND started IS NULL AND issued > ?2 ORDER BY issued DESC LIMIT 1").bind(user, since).first<string>("ticket");
		if (row === null) return null;
		return D1Ledger.#ticket(row);
	}

	async renew(ticket: Ticket): Promise<void> {
		await this.#database.prepare("UPDATE tickets SET ticket = ?2 WHERE id = ?1 AND started IS NULL").bind(ticket.id, JSON.stringify(Ticket.export(ticket))).run();
	}

	async take(bucket: Bucket, now: number): Promise<boolean> {
		const database = this.#database;
		const { key, capacity, period } = bucket;
		// SQLite evaluates every SET expression against the old row, so tokens and updated both see the stored values.
		// D1 binds every JavaScript number as REAL, so the refill division needs the casts to stay an integer division.
		const [, taken] = await database.batch([
			database.prepare("INSERT OR IGNORE INTO buckets (key, tokens, updated) VALUES (?1, ?2, ?3)").bind(key, capacity, now),
			database.prepare(`UPDATE buckets SET
				tokens = min(CAST(?2 AS INTEGER), tokens + (CAST(?3 AS INTEGER) - updated) / CAST(?4 AS INTEGER)) - 1,
				updated = CASE WHEN tokens + (CAST(?3 AS INTEGER) - updated) / CAST(?4 AS INTEGER) >= CAST(?2 AS INTEGER) THEN CAST(?3 AS INTEGER) ELSE updated + (CAST(?3 AS INTEGER) - updated) / CAST(?4 AS INTEGER) * CAST(?4 AS INTEGER) END
				WHERE key = ?1 AND tokens + (CAST(?3 AS INTEGER) - updated) / CAST(?4 AS INTEGER) >= 1
				RETURNING key`).bind(key, capacity, now, period),
		]);
		return taken.results.length > 0;
	}

	async refund(bucket: Bucket): Promise<void> {
		await this.#database.prepare("UPDATE buckets SET tokens = min(CAST(?2 AS INTEGER), tokens + 1) WHERE key = ?1").bind(bucket.key, bucket.capacity).run();
	}

	async wait(bucket: Bucket, now: number): Promise<number> {
		const updated = await this.#database.prepare("SELECT updated FROM buckets WHERE key = ?1").bind(bucket.key).first<number>("updated");
		return bucket.wait(ReferenceError.suppress(updated, `The bucket '${bucket.key}' is missing`), now);
	}

	async allowance(bucket: Bucket, now: number): Promise<Allowance> {
		const row = await this.#database.prepare("SELECT tokens, updated FROM buckets WHERE key = ?1").bind(bucket.key).first<BucketRow>();
		if (row === null) return bucket.full();
		return bucket.allowance(row.tokens, row.updated, now);
	}

	async save(ticket: Ticket, user: string, now: number): Promise<void> {
		await this.#database.prepare("INSERT INTO tickets (id, visitor, ticket, issued) VALUES (?1, ?2, ?3, ?4)").bind(ticket.id, user, JSON.stringify(Ticket.export(ticket)), now).run();
	}

	async start(id: string, user: string, since: number, now: number): Promise<Ticket | null> {
		const row = await this.#database.prepare("UPDATE tickets SET started = ?4 WHERE id = ?1 AND visitor = ?2 AND started IS NULL AND issued > ?3 RETURNING ticket").bind(id, user, since, now).first<string>("ticket");
		if (row === null) return null;
		return D1Ledger.#ticket(row);
	}

	async report(report: Report, user: string, since: number, now: number): Promise<boolean> {
		const moves = JSON.stringify(Array.Of(Move).export(report.moves));
		const row = await this.#database.prepare("UPDATE tickets SET reported = ?4, moves = ?5 WHERE id = ?1 AND visitor = ?2 AND started > ?3 AND reported IS NULL RETURNING id").bind(report.ticket, user, since, now, moves).first<string>("id");
		return row !== null;
	}

	async standing(): Promise<Standing> {
		const row = await this.#database.prepare("SELECT humanity, agent FROM standing WHERE id = 1").first();
		if (row === null) return new Standing();
		return Standing.import(row, "standing");
	}

	static #ticket(text: string): Ticket {
		return Ticket.import(JSON.parse(text), "ticket");
	}
}
//#endregion

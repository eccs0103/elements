"use strict";

import "adaptive-extender/core";
import { Field, Model, Nullable } from "adaptive-extender/core";
import { Move } from "../../playground/models/move.js";
import { Ticket, Report, Standing, Game, Schedule, Summary, Verdict, type Allowance } from "../models/protocol.js";
import { type Bucket } from "../models/bucket.js";
import { type Ledger } from "./arena.js";

//#region D1 ledger
interface BucketRow {
	tokens: number;
	updated: number;
}

class GameRow extends Model {
	@Field(String, { name: "id" })
	id: string;

	@Field(String, { name: "ticket" })
	ticket: string;

	@Field(Number, { name: "started" })
	started: number;

	@Field(Nullable.Of(Number), { name: "claimed" })
	claimed: number | null;

	@Field(Nullable.Of(Number), { name: "won" })
	won: number | null;

	@Field(Nullable.Of(String), { name: "scores" })
	scores: string | null;

	game(): Game {
		const { model, human, rules } = Ticket.import(JSON.parse(this.ticket), "ticket");
		const verdict = Nullable.map(this.scores, GameRow.#verdict);
		return new Game(this.id, model.name, human, rules.size ** 2, this.started, Nullable.map(this.claimed, Boolean), Nullable.map(this.won, Boolean), verdict);
	}

	static #verdict(text: string): Verdict {
		return new Verdict(Array.Of(Number).import(JSON.parse(text), "scores"));
	}
}

class RunRow extends Model {
	@Field(Number, { name: "started" })
	started: number;
}

export class D1Ledger implements Ledger {
	static #finished: string = "visitor = ?1 AND started IS NOT NULL AND (reported IS NOT NULL OR judged IS NOT NULL OR started < ?2)";
	#database: D1Database;

	constructor(database: D1Database) {
		this.#database = database;
	}

	async pending(user: string, since: number): Promise<Ticket | null> {
		const row = await this.#database.prepare("SELECT ticket FROM tickets WHERE visitor = ?1 AND started IS NULL AND issued > ?2 ORDER BY issued DESC LIMIT 1").bind(user, since).first<string>("ticket");
		return Nullable.map(row, D1Ledger.#ticket);
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

	async opened(id: string, user: string, since: number): Promise<Ticket | null> {
		const row = await this.#database.prepare("SELECT ticket FROM tickets WHERE id = ?1 AND visitor = ?2 AND started IS NULL AND issued > ?3").bind(id, user, since).first<string>("ticket");
		return Nullable.map(row, D1Ledger.#ticket);
	}

	async start(ticket: Ticket, user: string, since: number, now: number): Promise<boolean> {
		const row = await this.#database.prepare("UPDATE tickets SET started = ?4, ticket = ?5 WHERE id = ?1 AND visitor = ?2 AND started IS NULL AND issued > ?3 RETURNING id").bind(ticket.id, user, since, now, JSON.stringify(Ticket.export(ticket))).first<string>("id");
		return row !== null;
	}

	async report(report: Report, user: string, since: number, now: number): Promise<boolean> {
		const moves = JSON.stringify(Array.Of(Move).export(report.moves));
		const row = await this.#database.prepare("UPDATE tickets SET reported = ?4, moves = ?5, claimed = ?6 WHERE id = ?1 AND visitor = ?2 AND started > ?3 AND reported IS NULL RETURNING id").bind(report.ticket, user, since, now, moves, Number(report.won)).first<string>("id");
		return row !== null;
	}

	async standing(): Promise<Standing> {
		const row = await this.#database.prepare("SELECT humanity, agent, (SELECT count(*) FROM tickets WHERE started IS NOT NULL AND judged IS NULL AND reported IS NOT NULL AND claimed = 1) AS review_humanity, (SELECT count(*) FROM tickets WHERE started IS NOT NULL AND judged IS NULL AND reported IS NOT NULL AND claimed = 0) AS review_agent FROM standing WHERE id = 1").first();
		if (row === null) return new Standing();
		return Standing.import(row, "standing");
	}

	async games(user: string, since: number, limit: number): Promise<Game[]> {
		const { results } = await this.#database.prepare(`SELECT id, ticket, started, claimed, won, scores FROM tickets WHERE ${D1Ledger.#finished} ORDER BY started DESC LIMIT ?3`).bind(user, since, limit).all();
		return results.map(row => GameRow.import(row, "row").game());
	}

	async summary(user: string, since: number): Promise<Summary> {
		const row = await this.#database.prepare(`SELECT coalesce(sum(coalesce(won, claimed, 0) = 1), 0) AS wins, coalesce(sum(coalesce(won, claimed, 0) = 0), 0) AS losses, coalesce(sum(judged IS NULL), 0) AS reviewing FROM tickets WHERE ${D1Ledger.#finished}`).bind(user, since).first();
		if (row === null) return new Summary();
		return Summary.import(row, "summary");
	}

	async schedule(): Promise<Schedule> {
		const { results } = await this.#database.prepare("SELECT started FROM runs ORDER BY started").all();
		return new Schedule(results.map(row => RunRow.import(row, "row").started));
	}

	static #ticket(text: string): Ticket {
		return Ticket.import(JSON.parse(text), "ticket");
	}
}
//#endregion

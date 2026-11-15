"use strict";

import "adaptive-extender/node";
import { Any, Field, Model, Nullable, URI } from "adaptive-extender/node";
import { type VerifierEnvironment } from "../models/verifier-environment.js";
import { Referee } from "./referee.js";

//#region Remote database
class D1Result extends Model {
	@Field(Array.Of(Any), { name: "results" })
	results: unknown[];
}

class D1Answer extends Model {
	@Field(Boolean, { name: "success" })
	success: boolean;

	@Field(Array.Of(D1Result), { name: "result" })
	result: D1Result[];

	rows(): unknown[] {
		if (!this.success) throw new Error("D1 refused the query");
		return ReferenceError.suppress(this.result.at(0), "D1 answered without a result").results;
	}
}

class RemoteDatabase {
	#endpoint: URI;
	#token: string;

	constructor(environment: Readonly<VerifierEnvironment>) {
		if (!environment.complete) throw new ReferenceError("An environment variable of the verifier is empty");
		const { account, database, token } = environment;
		this.#endpoint = new URI(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`);
		this.#token = token;
	}

	async query(sql: string, params: readonly (string | number | null)[]): Promise<unknown[]> {
		const response = await fetch(this.#endpoint.href, {
			method: "POST",
			headers: { ["Authorization"]: `Bearer ${this.#token}`, ["Content-Type"]: "application/json" },
			body: JSON.stringify({ sql, params }),
		});
		const payload: unknown = await response.json();
		if (!response.ok) throw new Error(`D1 answered ${response.status}: ${JSON.stringify(payload)}`);
		return D1Answer.import(payload, "answer").rows();
	}
}
//#endregion
//#region Verifier
class TicketRow extends Model {
	@Field(String, { name: "id" })
	id: string;

	@Field(String, { name: "ticket" })
	ticket: string;

	@Field(Nullable.Of(String), { name: "moves" })
	moves: string | null;
}

export class Verifier {
	static #page: number = 100;
	static #hour: number = 3600000;
	#database: RemoteDatabase;

	constructor(environment: Readonly<VerifierEnvironment>) {
		this.#database = new RemoteDatabase(environment);
	}

	async run(now: number): Promise<void> {
		const database = this.#database;
		let humanity = 0;
		let agent = 0;
		while (true) {
			const rows = await database.query("SELECT id, ticket, moves FROM tickets WHERE started IS NOT NULL AND judged IS NULL AND (reported IS NOT NULL OR started < ?1) LIMIT ?2", [now - Referee.deadline, Verifier.#page]);
			if (rows.length === 0) break;
			for (const row of rows) {
				const { id, ticket, moves } = TicketRow.import(row, "row");
				const { won, scores } = Referee.decide(ticket, moves);
				await database.query("UPDATE tickets SET judged = ?2, won = ?3, scores = ?4 WHERE id = ?1 AND judged IS NULL", [id, now, Number(won), scores === null ? null : JSON.stringify(scores)]);
				if (won) humanity++;
				else agent++;
			}
		}
		await database.query("DELETE FROM tickets WHERE started IS NULL AND issued < ?1", [now - Referee.idle]);
		await database.query("DELETE FROM buckets WHERE updated < ?1", [now - Verifier.#hour]);
		console.log(`Judged ${humanity + agent} matches: humanity ${humanity}, agent ${agent}`);
	}
}
//#endregion

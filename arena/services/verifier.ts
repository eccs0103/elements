"use strict";

import "adaptive-extender/node";
import FileSystem from "node:fs";
import Crypto from "node:crypto";
import { Any, Field, Model, Nullable, URI } from "adaptive-extender/node";
import { type VerifierEnvironment } from "../models/verifier-environment.js";
import { Ticket, Report, Standing } from "../models/protocol.js";
import { Ruling, type Minds } from "./ruling.js";
import { type AgentModel } from "../../playground/models/agent-catalog.js";
import { Weights } from "../../playground/models/weights.js";
import { Network } from "../../playground/services/network.js";

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

	async query(sql: string, params: readonly unknown[]): Promise<unknown[]> {
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
//#region Library
class Library implements Minds {
	#catalog: URI;
	#networks: Map<string, Network> = new Map<string, Network>();

	constructor(catalog: URI) {
		this.#catalog = catalog;
	}

	of(model: AgentModel): Network {
		const { digest } = model;
		const networks = this.#networks;
		// Not simplified: Map.getOrInsertComputed would replace this cache, but package.json allows Node 22, which lacks it.
		const known = networks.get(digest);
		if (known !== undefined) return known;
		const bytes = FileSystem.readFileSync(model.weights(this.#catalog).toPath());
		const found = Crypto.createHash("sha256").update(bytes).digest("hex");
		if (found !== digest) throw new Error(`The weights of ${model.name} changed after its matches were played: ${found}, the ticket expects ${digest}`);
		const network = new Network(Weights.import(JSON.parse(bytes.toString("utf8")), "weights"));
		networks.set(digest, network);
		return network;
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

	@Field(Nullable.Of(Number), { name: "claimed" })
	claimed: number | null;

	match(): Ticket {
		return Ticket.import(JSON.parse(this.ticket), "ticket");
	}

	report(): Report | null {
		const { moves, claimed } = this;
		if (moves === null || claimed === null) return null;
		return Report.import({ ticket: this.id, moves: JSON.parse(moves), won: Boolean(claimed) }, "report");
	}
}

export class Verifier {
	static #page: number = 100;
	static #hour: number = 3600000;
	static #runs: number = 20;
	#database: RemoteDatabase;
	#library: Library;

	constructor(environment: Readonly<VerifierEnvironment>, catalog: URI) {
		this.#database = new RemoteDatabase(environment);
		this.#library = new Library(catalog);
	}

	async run(now: number): Promise<void> {
		const database = this.#database;
		const library = this.#library;
		const standing = new Standing();
		while (true) {
			const rows = await database.query("SELECT id, ticket, moves, claimed FROM tickets WHERE started IS NOT NULL AND judged IS NULL AND (reported IS NOT NULL OR started < ?1) LIMIT ?2", [now - Ticket.deadline, Verifier.#page]);
			if (rows.length === 0) break;
			for (const row of rows) {
				const record = TicketRow.import(row, "row");
				const ruling = Ruling.of(record.match(), record.report(), library);
				await database.query("UPDATE tickets SET judged = ?2, won = ?3, scores = ?4 WHERE id = ?1 AND judged IS NULL", [record.id, now, Number(ruling.won), ruling.record]);
				ruling.count(standing);
			}
		}
		await database.query("DELETE FROM tickets WHERE started IS NULL AND issued < ?1", [now - Ticket.idle]);
		await database.query("DELETE FROM buckets WHERE updated < ?1", [now - Verifier.#hour]);
		await database.query("INSERT OR IGNORE INTO runs (started) VALUES (?1)", [now]);
		await database.query("DELETE FROM runs WHERE started NOT IN (SELECT started FROM runs ORDER BY started DESC LIMIT ?1)", [Verifier.#runs]);
		const { humanity, agent } = standing;
		console.log(`Judged ${humanity + agent} matches: humanity ${humanity}, agent ${agent}`);
	}
}
//#endregion

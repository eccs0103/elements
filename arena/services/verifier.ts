"use strict";

import "adaptive-extender/node";
import FileSystem from "node:fs";
import { Any, Field, Model, Nullable, URI } from "adaptive-extender/node";
import { type VerifierEnvironment } from "../models/verifier-environment.js";
import { Ticket, Standing } from "../models/protocol.js";
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
		const { folder } = model;
		const networks = this.#networks;
		// Not simplified: Map.getOrInsertComputed would replace this cache, but package.json allows Node 22, which lacks it.
		const known = networks.get(folder);
		if (known !== undefined) return known;
		const text = FileSystem.readFileSync(model.weights(this.#catalog).toPath(), "utf8");
		const network = new Network(Weights.import(JSON.parse(text), "weights"));
		networks.set(folder, network);
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
}

export class Verifier {
	static #page: number = 100;
	static #hour: number = 3600000;
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
			const rows = await database.query("SELECT id, ticket, moves FROM tickets WHERE started IS NOT NULL AND judged IS NULL AND (reported IS NOT NULL OR started < ?1) LIMIT ?2", [now - Ticket.deadline, Verifier.#page]);
			if (rows.length === 0) break;
			for (const row of rows) {
				const { id, ticket, moves } = TicketRow.import(row, "row");
				const ruling = Ruling.of(ticket, moves, library);
				await database.query("UPDATE tickets SET judged = ?2, won = ?3, scores = ?4 WHERE id = ?1 AND judged IS NULL", [id, now, Number(ruling.won), ruling.record]);
				ruling.count(standing);
			}
		}
		await database.query("DELETE FROM tickets WHERE started IS NULL AND issued < ?1", [now - Ticket.idle]);
		await database.query("DELETE FROM buckets WHERE updated < ?1", [now - Verifier.#hour]);
		const { humanity, agent } = standing;
		console.log(`Judged ${humanity + agent} matches: humanity ${humanity}, agent ${agent}`);
	}
}
//#endregion

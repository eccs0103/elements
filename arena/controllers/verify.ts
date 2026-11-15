"use strict";

// No adaptive-extender here: the referee bundle carries its own copy, and a second one throws "Cannot redefine property".
import URLUtilities from "node:url";
import ChildProcess from "node:child_process";

//#region Remote database
interface Rows {
	results: Record<string, unknown>[];
}

interface Answer {
	success: boolean;
	result: Rows[];
}

class RemoteDatabase {
	#endpoint: string;
	#token: string;

	constructor(account: string, database: string, token: string) {
		this.#endpoint = `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`;
		this.#token = token;
	}

	static #require(name: string): string {
		const value = process.env[name];
		if (value === undefined || value.length === 0) throw new ReferenceError(`The environment variable ${name} is missing`);
		return value;
	}

	static fromEnvironment(): RemoteDatabase {
		return new RemoteDatabase(RemoteDatabase.#require("CLOUDFLARE_ACCOUNT_ID"), RemoteDatabase.#require("D1_DATABASE_ID"), RemoteDatabase.#require("CLOUDFLARE_API_TOKEN"));
	}

	async query(sql: string, params: readonly (string | number | null)[]): Promise<Record<string, unknown>[]> {
		const response = await fetch(this.#endpoint, {
			method: "POST",
			headers: { ["Authorization"]: `Bearer ${this.#token}`, ["Content-Type"]: "application/json" },
			body: JSON.stringify({ sql, params }),
		});
		const answer: unknown = await response.json();
		if (!response.ok || !RemoteDatabase.#answers(answer)) throw new Error(`D1 answered ${response.status}: ${JSON.stringify(answer)}`);
		const [rows] = answer.result;
		return rows.results;
	}

	static #answers(value: unknown): value is Answer {
		if (typeof value !== "object" || value === null || !("success" in value) || !("result" in value)) return false;
		const { success, result } = value;
		if (success !== true || !Array.isArray(result) || result.length === 0) return false;
		const [rows] = result;
		return typeof rows === "object" && rows !== null && "results" in rows && Array.isArray(rows.results);
	}
}
//#endregion
//#region Verifier
interface Ruling {
	won: boolean;
	scores: readonly number[] | null;
}

interface Referee {
	idle: number;
	deadline: number;
	decide(ticket: string, moves: string | null): Ruling;
}

class Verifier {
	static #page: number = 100;
	static #hour: number = 3600000;
	#database: RemoteDatabase;
	#referee: Referee;

	constructor(database: RemoteDatabase, referee: Referee) {
		this.#database = database;
		this.#referee = referee;
	}

	static async #load(): Promise<Referee> {
		const here = import.meta.url;
		const config = URLUtilities.fileURLToPath(new URL("../referee.jsonc", here));
		const output = new URL("../../dist/referee/", here);
		const wrangler = URLUtilities.fileURLToPath(new URL("../../node_modules/wrangler/bin/wrangler.js", here));
		// A relative --outdir with --config lands the bundle next to the config, not in the working directory.
		ChildProcess.execFileSync(process.execPath, [wrangler, "deploy", "--dry-run", "--config", config, "--outdir", URLUtilities.fileURLToPath(output)], { stdio: "ignore" });
		const bundle = await import(new URL("./referee-worker.js", output).href);
		return bundle.Referee;
	}

	static async launch(): Promise<void> {
		const verifier = new Verifier(RemoteDatabase.fromEnvironment(), await Verifier.#load());
		await verifier.run(Date.now());
	}

	async run(now: number): Promise<void> {
		const database = this.#database;
		const referee = this.#referee;
		let humanity = 0;
		let agent = 0;
		while (true) {
			const rows = await database.query("SELECT id, ticket, moves FROM tickets WHERE started IS NOT NULL AND judged IS NULL AND (reported IS NOT NULL OR started < ?1) LIMIT ?2", [now - referee.deadline, Verifier.#page]);
			if (rows.length === 0) break;
			for (const row of rows) {
				const { id, ticket, moves } = row;
				if (typeof id !== "string" || typeof ticket !== "string") throw new TypeError("A ticket row is malformed");
				const ruling = referee.decide(ticket, typeof moves === "string" ? moves : null);
				const { won, scores } = ruling;
				await database.query("UPDATE tickets SET judged = ?2, won = ?3, scores = ?4 WHERE id = ?1 AND judged IS NULL", [id, now, Number(won), scores === null ? null : JSON.stringify(scores)]);
				if (won) humanity++;
				else agent++;
			}
		}
		await database.query("DELETE FROM tickets WHERE started IS NULL AND issued < ?1", [now - referee.idle]);
		await database.query("DELETE FROM buckets WHERE updated < ?1", [now - Verifier.#hour]);
		console.log(`Judged ${humanity + agent} matches: humanity ${humanity}, agent ${agent}`);
	}
}
//#endregion

await Verifier.launch();

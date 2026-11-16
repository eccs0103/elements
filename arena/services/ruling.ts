"use strict";

import "adaptive-extender/core";
import { Human } from "../../playground/services/players.js";
import { Ticket, Report, Verdict, type Standing } from "../models/protocol.js";
import { type Mind } from "../../playground/services/agent.js";
import { type AgentModel } from "../../playground/models/agent-catalog.js";

//#region Ruling
export interface Minds {
	of(model: AgentModel): Mind;
}

export class Ruling {
	#won: boolean;
	#scores: readonly number[] | null;

	constructor(won: boolean, scores: readonly number[] | null) {
		this.#won = won;
		this.#scores = scores;
	}

	static of(ticket: string, moves: string | null, minds: Minds): Ruling {
		if (moves === null) return Ruling.#forfeit();
		try {
			const match = Ticket.import(JSON.parse(ticket), "ticket");
			const report = Report.import({ ticket: match.id, moves: JSON.parse(moves) }, "report");
			const verdict = Ruling.#replay(match, report, minds);
			const { human } = match;
			return new Ruling(verdict.winner(human) === human, verdict.scores);
		} catch {
			// A malformed or illegal report is swallowed on purpose: it counts as a forfeit, the agent wins.
			return Ruling.#forfeit();
		}
	}

	static #forfeit(): Ruling {
		return new Ruling(false, null);
	}

	static #replay(ticket: Ticket, report: Report, minds: Minds): Verdict {
		report.check(ticket.rules, ticket.human);
		const match = ticket.match();
		match.replay(report.moves, ticket.lineup(new Human(), ticket.agent(minds.of(ticket.model))));
		return Verdict.of(match);
	}

	get won(): boolean { return this.#won; }
	get record(): string | null {
		const scores = this.#scores;
		return scores === null ? null : JSON.stringify(scores);
	}

	count(standing: Standing): void {
		if (this.#won) standing.humanity++;
		else standing.agent++;
	}
}
//#endregion

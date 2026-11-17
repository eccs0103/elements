"use strict";

import "adaptive-extender/core";
import { Human } from "../../playground/services/players.js";
import { Verdict, type Ticket, type Report, type Standing } from "../models/protocol.js";
import { type Agent, type Mind } from "../../playground/services/agent.js";
import { type AgentModel } from "../../playground/models/agent-catalog.js";

//#region Ruling
// Not simplified: the verifier's Library is the only Minds, but it reads files (node) and Ruling is core.
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

	static of(ticket: Ticket, report: Report | null, minds: Minds): Ruling {
		if (report === null) return Ruling.#forfeit();
		const agent = ticket.agent(minds.of(ticket.model));
		try {
			return Ruling.#judge(ticket, report, agent);
		} catch {
			// Only the report's own faults reach here (too many moves, a foreign side, an illegal or leftover move): a forfeit, the agent wins. The agent loads outside the try, so a server fault fails the run instead of judging the human.
			return Ruling.#forfeit();
		}
	}

	static #forfeit(): Ruling {
		return new Ruling(false, null);
	}

	static #judge(ticket: Ticket, report: Report, agent: Agent): Ruling {
		const { human } = ticket;
		report.check(ticket.rules, human);
		const match = ticket.match();
		match.replay(report.moves, ticket.lineup(new Human(), agent));
		const verdict = Verdict.of(match);
		return new Ruling(verdict.winner(human) === human, verdict.scores);
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

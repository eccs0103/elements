"use strict";

import "adaptive-extender/web";
import { Nullable, URI } from "adaptive-extender/web";
import { type Allowance, type Standing, type Ticket, type Verdict } from "../../arena/models/protocol.js";
import { type AgentModel } from "../models/agent-catalog.js";

const { baseURI } = document;
const { ceil, trunc } = Math;

//#region Notice
export class Notice {
	static #second: number = 1000;
	static #minute: number = 60000;
	#title: string;
	#description: string;
	#note: string | null = null;
	#hint: string | null = null;
	#deadline: number | null = null;
	#busy: boolean = false;
	#playable: boolean = false;
	#action: string | null = null;
	#target: URI | null = null;

	constructor(title: string, description: string) {
		this.#title = title;
		this.#description = description;
	}

	static connecting(): Notice {
		const notice = new Notice("Arena", "Matches here count for Humanity against the agent.");
		notice.#hint = "Connecting to the arena…";
		notice.#busy = true;
		return notice;
	}

	static loading(): Notice {
		const notice = new Notice("Your rival is getting ready", "Loading the match takes a few seconds");
		notice.#hint = "Loading the match…";
		notice.#busy = true;
		return notice;
	}

	static ready(standing: Standing, ticket: Ticket, model: AgentModel, allowance: Allowance | null): Notice {
		const notice = new Notice(Notice.#score(standing, model), Notice.#rules(ticket));
		notice.#note = Nullable.map(allowance, Notice.#rest.bind(Notice));
		notice.#hint = "Drag a card to start the game";
		notice.#playable = true;
		return notice;
	}

	static practice(ticket: Ticket, model: AgentModel): Notice {
		const notice = new Notice(`Practice against ${model.name}`, Notice.#rules(ticket));
		notice.#note = "Free and unlimited, nothing is counted";
		notice.#hint = "Drag a card to start the game";
		notice.#playable = true;
		return notice;
	}

	static judging(verdict: Verdict, ticket: Ticket, model: AgentModel): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket, model), "The match is over");
		notice.#hint = "Saving the result…";
		notice.#busy = true;
		notice.#action = "Play again";
		return notice;
	}

	static outcome(verdict: Verdict, ticket: Ticket, model: AgentModel, standing: Standing, allowance: Allowance | null): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket, model), Notice.#score(standing, model));
		notice.#action = "Play again";
		if (allowance === null) return notice;
		if (allowance.left > 0) {
			notice.#note = `${Notice.#matches(allowance.left)} left`;
			return notice;
		}
		notice.#note = "No matches left for now";
		notice.#deadline = Date.now() + allowance.wait;
		return notice;
	}

	static practiced(verdict: Verdict, ticket: Ticket, model: AgentModel): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket, model), "Practice match, not counted");
		notice.#action = "Play again";
		return notice;
	}

	static uncounted(verdict: Verdict, ticket: Ticket, model: AgentModel, reason: Error): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket, model), `The arena did not count this match: ${reason.message}`);
		notice.#action = "Play again";
		return notice;
	}

	static shortage(allowance: Allowance): Notice {
		const notice = new Notice("No matches left", "Matches come back one by one over time. Practice is open meanwhile.");
		notice.#deadline = Date.now() + allowance.wait;
		notice.#action = "Play";
		return notice;
	}

	static unfinished(count: number, capacity: number): Notice {
		const notice = new Notice("Your deck is not ready", `It holds ${count} of ${capacity} elements. Fill it to play.`);
		notice.#action = "Open the deck";
		notice.#target = new URI("../deck/", baseURI);
		return notice;
	}

	static trouble(reason: Error): Notice {
		const notice = new Notice("The match could not start", reason.message);
		notice.#action = "Try again";
		return notice;
	}

	get title(): string { return this.#title; }
	get description(): string { return this.#description; }
	get note(): string | null { return this.#note; }
	get deadline(): number | null { return this.#deadline; }
	get busy(): boolean { return this.#busy; }
	get playable(): boolean { return this.#playable; }
	get action(): string | null { return this.#action; }
	get target(): URI | null { return this.#target; }
	get hint(): string | null { return this.#hint; }

	caption(now: number): string | null {
		const action = this.#action;
		if (action === null) return null;
		if (this.#busy) return this.#hint ?? action;
		const deadline = this.#deadline;
		if (deadline === null || now >= deadline) return action;
		const left = ceil((deadline - now) / Notice.#second);
		return `${action} in ${trunc(left / 60)}:${String(left % 60).padStart(2, "0")}`;
	}

	locked(now: number): boolean {
		if (this.#busy) return true;
		const deadline = this.#deadline;
		return deadline !== null && now < deadline;
	}

	static #rules(ticket: Ticket): string {
		return `Drop elements to spread over the board: more cells after ${ticket.rules.seconds} s wins.`;
	}

	static #score(standing: Standing, model: AgentModel): string {
		return `Humanity ${standing.humanity} : ${standing.agent} ${model.name}`;
	}

	static #outcome(verdict: Verdict, ticket: Ticket, model: AgentModel): string {
		const { human } = ticket;
		const winner = verdict.winner(human) === human ? "You won" : `${model.name} won`;
		return `${winner} ${verdict.scores[human]} : ${verdict.against(human)}`;
	}

	static #rest(allowance: Allowance): string {
		const { left, wait } = allowance;
		if (left === 0) return `Your last match for now. The next one comes in ${ceil(wait / Notice.#minute)} min.`;
		if (wait === 0) return `${Notice.#matches(left)} left after this one`;
		return `${Notice.#matches(left)} left after this one, one more in ${ceil(wait / Notice.#minute)} min`;
	}

	static #matches(count: number): string {
		return `${count} ${count === 1 ? "match" : "matches"}`;
	}
}
//#endregion

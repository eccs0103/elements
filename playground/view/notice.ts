"use strict";

import "adaptive-extender/web";
import { Nullable, URI } from "adaptive-extender/web";
import { type Allowance, type Standing, type Ticket, type Verdict } from "../../arena/models/protocol.js";

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
	#hidden: boolean = false;
	#action: string | null = null;
	#target: URI | null = null;

	constructor(title: string, description: string) {
		this.#title = title;
		this.#description = description;
	}

	static loading(): Notice {
		const notice = new Notice("Your rival is getting ready", "Loading the match takes a few seconds");
		notice.#hint = "Loading the match…";
		notice.#busy = true;
		return notice;
	}

	static ready(standing: Standing, ticket: Ticket, allowance: Allowance | null): Notice {
		const notice = new Notice(Notice.#score(standing, ticket), `Drop elements to spread over the board: more cells after ${ticket.rules.seconds} s wins.`);
		notice.#note = Nullable.map(allowance, Notice.#rest.bind(Notice));
		notice.#hint = "Drag a card to start the game";
		return notice;
	}

	static playing(): Notice {
		const notice = new Notice(String.empty, String.empty);
		notice.#hidden = true;
		return notice;
	}

	static judging(verdict: Verdict, ticket: Ticket): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), "The match is over");
		notice.#hint = "Saving the result…";
		notice.#busy = true;
		return notice;
	}

	static outcome(verdict: Verdict, ticket: Ticket, standing: Standing, allowance: Allowance | null): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), Notice.#score(standing, ticket));
		notice.#again("Play again");
		if (allowance === null) return notice;
		if (allowance.left > 0) {
			notice.#note = `${Notice.#matches(allowance.left)} left`;
			return notice;
		}
		notice.#note = "No matches left for now";
		notice.#deadline = Date.now() + allowance.wait;
		return notice;
	}

	static uncounted(verdict: Verdict, ticket: Ticket, reason: Error): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), `The arena did not count this match: ${reason.message}`);
		notice.#again("Play again");
		return notice;
	}

	static shortage(allowance: Allowance): Notice {
		const notice = new Notice("No matches left", "Matches come back one by one over time.");
		notice.#deadline = Date.now() + allowance.wait;
		notice.#again("Play");
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
		notice.#again("Try again");
		return notice;
	}

	get title(): string { return this.#title; }
	get description(): string { return this.#description; }
	get note(): string | null { return this.#note; }
	get deadline(): number | null { return this.#deadline; }
	get busy(): boolean { return this.#busy; }
	get hidden(): boolean { return this.#hidden; }
	get action(): string | null { return this.#action; }
	get target(): URI | null { return this.#target; }

	line(now: number): string | null {
		const deadline = this.#deadline;
		if (deadline === null) return this.#hint;
		if (now >= deadline) return "A new match is ready";
		const left = ceil((deadline - now) / Notice.#second);
		return `Next match in ${trunc(left / 60)}:${String(left % 60).padStart(2, "0")}`;
	}

	locked(now: number): boolean {
		const deadline = this.#deadline;
		return deadline !== null && now < deadline;
	}

	#again(action: string): void {
		this.#action = action;
		this.#target = new URI("./", baseURI);
	}

	static #score(standing: Standing, ticket: Ticket): string {
		return `Humanity ${standing.humanity} : ${standing.agent} ${ticket.model}`;
	}

	static #outcome(verdict: Verdict, ticket: Ticket): string {
		const { human, model } = ticket;
		const winner = verdict.winner(human) === human ? "You won" : `${model} won`;
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

"use strict";

import "adaptive-extender/web";
import { URI } from "adaptive-extender/web";
import { type Allowance, type Standing, type Ticket, type Verdict } from "../../arena/models/protocol.js";

const { baseURI } = document;
const { ceil, trunc } = Math;

//#region Notice
export class Notice {
	static #second: number = 1000;
	static #counted: string = "Matches here count for Humanity";
	static #uncounted: string = "Practice, not counted";
	static #review: string = "Counts after review";
	static #start: string = "Drag a card to start";
	static #loading: string = "Loading the match…";
	static #again: string = "Play again";
	#title: string;
	#description: string;
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
		const notice = new Notice("Arena", Notice.#counted);
		notice.#hint = "Connecting…";
		notice.#busy = true;
		return notice;
	}

	static loading(): Notice {
		const notice = new Notice("Arena", Notice.#counted);
		notice.#hint = Notice.#loading;
		notice.#busy = true;
		return notice;
	}

	static preparing(): Notice {
		const notice = new Notice("Practice", Notice.#uncounted);
		notice.#hint = Notice.#loading;
		notice.#busy = true;
		return notice;
	}

	static ready(standing: Standing, ticket: Ticket): Notice {
		const notice = new Notice(`Humanity ${standing.humanity} : ${standing.agent} ${ticket.model.name}`, Notice.#rules(ticket));
		notice.#hint = Notice.#start;
		notice.#playable = true;
		return notice;
	}

	static practice(ticket: Ticket): Notice {
		const notice = new Notice(`Practice vs ${ticket.model.name}`, Notice.#rules(ticket));
		notice.#hint = Notice.#start;
		notice.#playable = true;
		return notice;
	}

	static judging(verdict: Verdict, ticket: Ticket): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), Notice.#review);
		notice.#hint = "Saving…";
		notice.#busy = true;
		notice.#action = Notice.#again;
		return notice;
	}

	static outcome(verdict: Verdict, ticket: Ticket, allowance: Allowance | null): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), Notice.#review);
		notice.#action = Notice.#again;
		if (allowance === null || allowance.left > 0) return notice;
		notice.#deadline = Date.now() + allowance.wait;
		return notice;
	}

	static practiced(verdict: Verdict, ticket: Ticket): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), Notice.#uncounted);
		notice.#action = Notice.#again;
		return notice;
	}

	static uncounted(verdict: Verdict, ticket: Ticket, reason: Error): Notice {
		const notice = new Notice(Notice.#outcome(verdict, ticket), `Not counted: ${reason.message}`);
		notice.#action = Notice.#again;
		return notice;
	}

	static shortage(allowance: Allowance): Notice {
		const notice = new Notice("No matches left", "Practice is open meanwhile");
		notice.#deadline = Date.now() + allowance.wait;
		notice.#action = "Play";
		return notice;
	}

	static unfinished(count: number, capacity: number): Notice {
		const notice = new Notice("Deck not ready", `${count} of ${capacity} elements`);
		notice.#action = "Open the deck";
		notice.#target = new URI("../deck/", baseURI);
		return notice;
	}

	static trouble(reason: Error): Notice {
		const notice = new Notice("Match could not start", reason.message);
		notice.#action = "Try again";
		return notice;
	}

	get title(): string { return this.#title; }
	get description(): string { return this.#description; }
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
		return `Most cells after ${ticket.rules.seconds} s wins`;
	}

	static #outcome(verdict: Verdict, ticket: Ticket): string {
		const { human, model } = ticket;
		const winner = verdict.winner(human) === human ? "You won" : `${model.name} won`;
		return `${winner} ${verdict.scores[human]} : ${verdict.against(human)}`;
	}

}
//#endregion

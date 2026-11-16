"use strict";

import "adaptive-extender/web";
import { URI } from "adaptive-extender/web";
import { type Allowance, type Standing, type Ticket, type Verdict } from "../../arena/models/protocol.js";

const { baseURI } = document;
const { ceil, trunc, max } = Math;

//#region Notice
export class Notice {
	static #second: number = 1000;
	static #counted: string = "Matches here count for Humanity";
	static #uncounted: string = "Practice, not counted";
	static #review: string = "Counts after review";
	static #start: string = "Drag a card to start";
	static #again: string = "Drag a card to play again";
	static #loading: string = "Loading the match…";
	static #next: string = "Next match in";
	#title: string;
	#description: string;
	#hint: string | null = null;
	#deadline: number | null = null;
	#busy: boolean = false;
	#playable: boolean = false;
	#action: string | null = null;
	#target: URI | null = null;
	#standing: Standing | null = null;
	#rival: string | null = null;

	constructor(title: string, description: string) {
		this.#title = title;
		this.#description = description;
	}

	static connecting(): Notice {
		return new Notice("Arena", Notice.#counted).#loads("Connecting…");
	}

	static loading(): Notice {
		return new Notice("Arena", Notice.#counted).#loads(Notice.#loading);
	}

	static preparing(): Notice {
		return new Notice("Practice", Notice.#uncounted).#loads(Notice.#loading);
	}

	static ready(standing: Standing, ticket: Ticket): Notice {
		const { name } = ticket.model;
		const notice = new Notice(`Humanity ${standing.humanity} : ${standing.agent} ${name}`, Notice.#rules(ticket)).#plays(Notice.#start);
		notice.#standing = standing;
		notice.#rival = name;
		return notice;
	}

	static practice(ticket: Ticket): Notice {
		return new Notice(`Practice vs ${ticket.model.name}`, Notice.#rules(ticket)).#plays(Notice.#start);
	}

	static shortage(allowance: Allowance): Notice {
		return new Notice("No matches left", "Practice is open meanwhile").wait(allowance);
	}

	static outcome(verdict: Verdict, ticket: Ticket): Notice {
		return new Notice(Notice.#outcome(verdict, ticket), Notice.#review);
	}

	static practiced(verdict: Verdict, ticket: Ticket): Notice {
		return new Notice(Notice.#outcome(verdict, ticket), Notice.#uncounted);
	}

	static uncounted(verdict: Verdict, ticket: Ticket, reason: Error): Notice {
		return new Notice(Notice.#outcome(verdict, ticket), `Not counted: ${reason.message}`);
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
	get standing(): Standing | null { return this.#standing; }
	get rival(): string | null { return this.#rival; }

	saving(): Notice {
		return this.#copy().#loads("Saving…");
	}

	next(): Notice {
		return this.#copy().#loads("Loading the next match…");
	}

	again(): Notice {
		return this.#copy().#plays(Notice.#again);
	}

	wait(allowance: Allowance): Notice {
		const notice = this.#copy();
		notice.#hint = Notice.#next;
		notice.#deadline = Date.now() + allowance.wait;
		return notice;
	}

	prompt(now: number): string | null {
		const hint = this.#hint;
		const deadline = this.#deadline;
		if (hint === null || deadline === null) return hint;
		const left = ceil(max(0, deadline - now) / Notice.#second);
		return `${hint} ${trunc(left / 60)}:${String(left % 60).padStart(2, "0")}`;
	}

	#copy(): Notice {
		return new Notice(this.#title, this.#description);
	}

	#loads(hint: string): Notice {
		this.#hint = hint;
		this.#busy = true;
		return this;
	}

	#plays(hint: string): Notice {
		this.#hint = hint;
		this.#playable = true;
		return this;
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

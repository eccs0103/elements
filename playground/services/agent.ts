"use strict";

import "adaptive-extender/core";
import { type Move } from "../models/move.js";
import { Observation } from "../models/observation.js";
import { type Match } from "./match.js";
import { type Player } from "./players.js";

//#region Agent
export interface Mind {
	ask(question: Observation, agent: Agent): void;
}

export class Agent implements Player {
	#mind: Mind;
	#reaction: number;
	#question: Observation | null = null;
	#answer: number | null = null;
	#due: number = 0;

	constructor(mind: Mind, reaction: number) {
		this.#mind = mind;
		this.#reaction = reaction;
	}

	answer(action: number): void {
		this.#answer = action;
	}

	waits(match: Match): boolean {
		return this.#question !== null && this.#answer === null && match.tick >= this.#due;
	}

	act(match: Match, side: number): Move | null {
		if (!match.ready(side)) return null;
		const question = this.#question;
		if (question === null) return this.#ask(match, side);
		if (match.tick < this.#due) return null;
		const answer = this.#answer;
		if (answer === null) return null;
		this.#question = null;
		this.#answer = null;
		return question.move(answer, match.tick);
	}

	#ask(match: Match, side: number): null {
		if (match.cells(side, 0).length === 0) return null;
		const question = Observation.of(match, side);
		this.#question = question;
		this.#answer = null;
		this.#due = match.tick + this.#reaction;
		this.#mind.ask(question, this);
		return null;
	}
}
//#endregion

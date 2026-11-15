"use strict";

import "adaptive-extender/worker";
import { type Move } from "../models/move.js";
import { Observation } from "../models/observation.js";
import { AgentCommand, DecideCommand, DecisionCommand } from "../models/agent-commands.js";
import { type Match } from "./match.js";
import { type Player } from "./players.js";

//#region Agent
export class Agent implements Player {
	#worker: Worker;
	#question: Observation | null = null;
	#answer: number | null = null;

	constructor(worker: Worker) {
		this.#worker = worker;
		worker.addEventListener("message", this.#onMessage.bind(this));
	}

	#onMessage(event: MessageEvent): void {
		const command = AgentCommand.import(event.data, "command");
		if (!(command instanceof DecisionCommand)) return;
		this.#answer = command.action;
	}

	act(match: Match, side: number): Move | null {
		if (!match.ready(side)) return null;
		const question = this.#question;
		if (question === null) return this.#ask(match, side);
		const answer = this.#answer;
		if (answer === null) return null;
		this.#question = null;
		this.#answer = null;
		return question.move(answer, match.tick);
	}

	#ask(match: Match, side: number): null {
		const observation = Observation.of(match, side);
		this.#question = observation;
		this.#worker.postMessage(AgentCommand.export(new DecideCommand(observation)));
		return null;
	}
}
//#endregion

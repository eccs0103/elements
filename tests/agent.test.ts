"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import FileSystem from "node:fs";
import { describe, it, expect } from "vitest";
import { Rules } from "../playground/models/rules.js";
import { AgentCatalog } from "../playground/models/agent-catalog.js";
import { Weights } from "../playground/models/weights.js";
import { type Observation } from "../playground/models/observation.js";
import { Network } from "../playground/services/network.js";
import { type Agent, type Mind } from "../playground/services/agent.js";
import { Human } from "../playground/services/players.js";
import { Dice } from "../playground/services/dice.js";
import { Ticket, Verdict } from "../arena/models/protocol.js";

//#region Late mind
class LateMind implements Mind {
	#network: Network;
	#seed: number;
	#asked: number = 0;
	#clock: number = 0;
	#agent: Agent | null = null;
	#question: Observation | null = null;
	#arrival: number = 0;
	#stalls: number = 0;

	constructor(network: Network, seed: number) {
		this.#network = network;
		this.#seed = seed;
	}

	get stalls(): number { return this.#stalls; }

	ask(question: Observation, agent: Agent): void {
		const asked = this.#asked;
		this.#asked = asked + 1;
		this.#agent = agent;
		this.#question = question;
		this.#arrival = this.#clock + Dice.roll(this.#seed, asked, 0, 0) % 120;
	}

	tick(): void {
		const clock = this.#clock + 1;
		this.#clock = clock;
		const agent = this.#agent;
		const question = this.#question;
		if (agent === null || question === null || clock < this.#arrival) return;
		this.#agent = null;
		this.#question = null;
		agent.answer(this.#network.decide(question));
	}

	stall(): void {
		this.#stalls++;
	}
}
//#endregion

describe("Agent", () => {
	it("replays a live match with late answers into the same board", () => {
		const catalog = new URI("../resources/models.json", new URI(import.meta.url));
		const model = AgentCatalog.import(JSON.parse(FileSystem.readFileSync(catalog.toPath(), "utf8")), "catalog").first;
		const network = new Network(Weights.import(JSON.parse(FileSystem.readFileSync(model.weights(catalog).toPath(), "utf8")), "weights"));
		const seed = 0x2F6B9A3;
		const ticket = Ticket.deal("agent-test", seed, seed + 1, Ticket.draft(new Rules(), seed, Ticket.human).elements, model);
		const mind = new LateMind(network, seed);
		const agent = ticket.agent(mind);
		const live = ticket.match();
		const players = ticket.lineup(Ticket.bot(seed, Ticket.human), agent);
		while (!live.finished) {
			mind.tick();
			if (agent.waits(live)) {
				mind.stall();
				continue;
			}
			live.advance(players);
		}
		const { human } = ticket;
		const moves = live.moves.filter(move => move.side === human);
		const replay = ticket.match();
		replay.replay(moves, ticket.lineup(new Human(), ticket.agent(network)));
		expect(live.moves.length - moves.length).toBeGreaterThan(0);
		expect(mind.stalls).toBeGreaterThan(0);
		expect(Verdict.of(replay).scores).toEqual(Verdict.of(live).scores);
		expect(replay.hash).toBe(live.hash);
	}, 180000);
});

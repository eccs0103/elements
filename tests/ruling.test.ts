"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import FileSystem from "node:fs";
import { describe, it, expect } from "vitest";
import { Rules } from "../playground/models/rules.js";
import { Move } from "../playground/models/move.js";
import { AgentCatalog, type AgentModel } from "../playground/models/agent-catalog.js";
import { Weights } from "../playground/models/weights.js";
import { Network } from "../playground/services/network.js";
import { type Mind } from "../playground/services/agent.js";
import { Ticket, Report, Verdict } from "../arena/models/protocol.js";
import { Ruling, type Minds } from "../arena/services/ruling.js";
import { Bot } from "./bot.js";

//#region Shelf
class Shelf implements Minds {
	#network: Network;

	constructor(network: Network) {
		this.#network = network;
	}

	of(model: AgentModel): Mind {
		void model;
		return this.#network;
	}
}
//#endregion
//#region Empty shelf
class EmptyShelf implements Minds {
	of(model: AgentModel): Mind {
		throw new ReferenceError(`The weights of ${model.name} are missing`);
	}
}
//#endregion

describe("Ruling", () => {
	const catalog = new URI("../resources/models.json", new URI(import.meta.url));
	const model = AgentCatalog.import(JSON.parse(FileSystem.readFileSync(catalog.toPath(), "utf8")), "catalog").first;
	const network = new Network(Weights.import(JSON.parse(FileSystem.readFileSync(model.weights(catalog).toPath(), "utf8")), "weights"));
	const shelf = new Shelf(network);
	const seed = 0x5EC0D;
	const ticket = Ticket.deal("ruling-test", seed, seed + 1, Ticket.draft(new Rules(), seed, Ticket.human).elements, model);
	const { human } = ticket;
	const live = ticket.match();
	const players = ticket.lineup(new Bot(seed + 9), ticket.agent(network));
	while (!live.finished) live.advance(players);
	const moves = live.moves.filter(move => move.side === human);
	const [first] = moves;

	it("judges an honest report with the browser's result, whatever it claims", () => {
		const verdict = Verdict.of(live);
		const ruling = Ruling.of(ticket, new Report(ticket.id, moves, false), shelf);
		expect(ruling.won).toBe(verdict.winner(human) === human);
		expect(ruling.record).toBe(JSON.stringify(verdict.scores));
	}, 60000);

	it("counts a missing report as a forfeit", () => {
		const ruling = Ruling.of(ticket, null, shelf);
		expect(ruling.won).toBe(false);
		expect(ruling.record).toBe(null);
	});

	it("counts an illegal move as a forfeit", () => {
		const forged = [first, new Move(first.tick + 1, human, 0, first.x, first.y), ...moves.slice(1)];
		const ruling = Ruling.of(ticket, new Report(ticket.id, forged, true), shelf);
		expect(ruling.won).toBe(false);
		expect(ruling.record).toBe(null);
	}, 60000);

	it("counts a move of the agent's side as a forfeit", () => {
		const forged = [new Move(first.tick, 1 - human, first.slot, first.x, first.y), ...moves.slice(1)];
		const ruling = Ruling.of(ticket, new Report(ticket.id, forged, true), shelf);
		expect(ruling.won).toBe(false);
	});

	it("fails instead of judging when the agent can't load", () => {
		expect(() => Ruling.of(ticket, new Report(ticket.id, moves, true), new EmptyShelf())).toThrow(ReferenceError);
	});
});

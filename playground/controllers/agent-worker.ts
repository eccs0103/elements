"use strict";

import "adaptive-extender/worker";
import { Controller, type URI } from "adaptive-extender/worker";
import { Weights } from "../models/weights.js";
import { AgentCommand, LoadCommand, DecideCommand, DecisionCommand } from "../models/agent-commands.js";
import { Network } from "../services/network.js";

//#region Agent worker
class AgentWorker extends Controller {
	#source: URI | null = null;
	#network: Promise<Network> | null = null;

	async #load(source: URI): Promise<Network> {
		const response = await fetch(source.href);
		if (!response.ok) throw new ReferenceError(`The agent weights could not load (${response.status})`);
		return new Network(Weights.import(await response.json(), "weights"));
	}

	#switch(source: URI): void {
		if (source.href === this.#source?.href) return;
		this.#source = source;
		const network = this.#network = this.#load(source);
		void this.#watch(network);
	}

	async #watch(network: Promise<Network>): Promise<void> {
		try {
			await network;
		} catch (reason) {
			reportError(Error.from(reason));
		}
	}

	async #decide(command: DecideCommand): Promise<void> {
		try {
			const network = await ReferenceError.suppress(this.#network, "The agent has no weights to decide with");
			const { number, observation } = command;
			self.postMessage(AgentCommand.export(new DecisionCommand(number, network.decide(observation))));
		} catch (reason) {
			reportError(Error.from(reason));
		}
	}

	#onMessage(event: MessageEvent): void {
		const command = AgentCommand.import(event.data, "command");

		if (command instanceof LoadCommand) {
			this.#switch(command.source);
			return;
		}

		if (command instanceof DecideCommand) {
			void this.#decide(command);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await AgentWorker.launch();

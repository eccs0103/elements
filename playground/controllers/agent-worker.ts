"use strict";

import "adaptive-extender/worker";
import { Controller, URI } from "adaptive-extender/worker";
import { Weights } from "../models/weights.js";
import { AgentCommand, DecideCommand, DecisionCommand } from "../models/agent-commands.js";
import { Network } from "../services/network.js";

//#region Agent worker
class AgentWorker extends Controller {
	static #weights: string = "../../agent/weights.json";
	#network: Promise<Network>;

	async #load(): Promise<Network> {
		const response = await fetch(new URI(AgentWorker.#weights, self.location.href).href);
		if (!response.ok) throw new ReferenceError(`The agent weights could not load (${response.status})`);
		return new Network(Weights.import(await response.json(), "weights"));
	}

	async #decide(command: DecideCommand): Promise<void> {
		const network = await this.#network;
		self.postMessage(AgentCommand.export(new DecisionCommand(network.decide(command.observation))));
	}

	#onMessage(event: MessageEvent): void {
		const command = AgentCommand.import(event.data, "command");
		if (!(command instanceof DecideCommand)) return;
		void this.#decide(command);
	}

	async run(): Promise<void> {
		this.#network = this.#load();
		self.addEventListener("message", this.#onMessage.bind(this));
		await this.#network;
	}
}
//#endregion

await AgentWorker.launch();

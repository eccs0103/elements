"use strict";

import "adaptive-extender/worker";
import { Controller, type URI } from "adaptive-extender/worker";
import { Weights } from "../models/weights.js";
import { AgentCommand, LoadCommand, DecideCommand, DecisionCommand } from "../models/agent-commands.js";
import { Network } from "../services/network.js";

//#region Agent worker
class AgentWorker extends Controller {
	#network: PromiseWithResolvers<Network> = Promise.withResolvers<Network>();

	async #load(source: URI): Promise<void> {
		const network = this.#network;
		try {
			const response = await fetch(source.href);
			if (!response.ok) throw new ReferenceError(`The agent weights could not load (${response.status})`);
			network.resolve(new Network(Weights.import(await response.json(), "weights")));
		} catch (reason) {
			network.reject(Error.from(reason));
		}
	}

	async #decide(command: DecideCommand): Promise<void> {
		const network = await this.#network.promise;
		self.postMessage(AgentCommand.export(new DecisionCommand(network.decide(command.observation))));
	}

	#onMessage(event: MessageEvent): void {
		const command = AgentCommand.import(event.data, "command");

		if (command instanceof LoadCommand) {
			void this.#load(command.source);
			return;
		}

		if (command instanceof DecideCommand) {
			void this.#decide(command);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
		await this.#network.promise;
	}
}
//#endregion

await AgentWorker.launch();

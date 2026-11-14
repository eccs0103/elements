"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsService } from "../../settings/services/settings-service.js";
import { DeckService } from "../services/deck-service.js";
import { type Simulation } from "../services/simulation.js";
import { PlaygroundApp } from "../view/playground-app.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Entry } from "../../arena/models/protocol.js";
import { Relay } from "../../arena/services/relay.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body } = document;
const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Playground controller
class PlaygroundController extends Controller {
	#arena: ArenaClient = new ArenaClient(new Relay(), new URI("/", baseURI));

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.content.apply();
		const { content } = deck;
		if (!content.full) return this.#complete(content.elements.length, content.capacity);

		const arena = this.#arena;
		const ticket = await arena.open(new Entry(content.elements));
		const standing = await arena.standing();
		const divRoot = body.getElement(HTMLDivElement, "div#root");
		createRoot(divRoot).render(<StrictMode><PlaygroundApp ticket={ticket} standing={standing} onFinish={simulation => void this.#guard(this.#judge(simulation))} /></StrictMode>);
	}

	#complete(count: number, capacity: number): void {
		if (!window.confirm(`Your deck holds ${count} of ${capacity} elements.\nOpen the deck to finish it?`)) return;
		location.assign(new URI("../deck/", baseURI).href);
	}

	async #guard(task: Promise<void>): Promise<void> {
		try {
			await task;
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	}

	async #judge(simulation: Simulation): Promise<void> {
		const { ticket, report } = simulation;
		if (ticket === null || report === null) return;
		const arena = this.#arena;
		const verdict = await arena.judge(report);
		const { humanity, agent } = await arena.standing();
		const { human, model } = ticket;
		const mine = verdict.scores[human];
		const theirs = verdict.against(human);
		const outcome = verdict.winner(human) === human ? "You won" : `${model} won`;
		if (!window.confirm(`${outcome} ${mine} : ${theirs}.\nHumanity ${humanity} : ${agent} ${model}.\nPlay again?`)) return;
		location.reload();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

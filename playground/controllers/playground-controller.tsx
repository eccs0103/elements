"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsService } from "../../settings/services/settings-service.js";
import { DeckService } from "../services/deck-service.js";
import { type Simulation } from "../services/simulation.js";
import { Challenge } from "../services/challenge.js";
import { PlaygroundApp } from "../view/playground-app.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Entry, Start, type Report } from "../../arena/models/protocol.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body, head } = document;
const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Playground controller
class PlaygroundController extends Controller {
	#arena: ArenaClient = new ArenaClient(globalThis, new URI("/", baseURI));

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();
		const { content } = deck;
		if (!content.full) return this.#complete(content.elements.length, content.capacity);

		const arena = this.#arena;
		const challenge = new Challenge(body.getElement(HTMLDivElement, "div#gate"), head.getElement(HTMLScriptElement, "script#challenge"));
		const ticket = await arena.open(new Entry(content.elements, await challenge.token()));
		const standing = await arena.standing();
		const divRoot = body.getElement(HTMLDivElement, "div#root");
		createRoot(divRoot).render(<StrictMode><PlaygroundApp ticket={ticket} standing={standing} onLaunch={simulation => void this.#guard(this.#start(simulation))} onFinish={simulation => void this.#guard(this.#judge(simulation))} /></StrictMode>);
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

	async #start(simulation: Simulation): Promise<void> {
		const { ticket } = simulation;
		if (ticket === null) return;
		simulation.start(await this.#arena.start(new Start(ticket.id)));
	}

	async #judge(simulation: Simulation): Promise<void> {
		const { ticket, report, verdict } = simulation;
		if (ticket === null || report === null || verdict === null) return;
		const { human, model } = ticket;
		const mine = verdict.scores[human];
		const theirs = verdict.against(human);
		const outcome = verdict.winner(human) === human ? "You won" : `${model} won`;
		const standing = await this.#submit(report, model);
		if (!window.confirm(`${outcome} ${mine} : ${theirs}.\n${standing}\nPlay again?`)) return;
		location.reload();
	}

	async #submit(report: Report, model: string): Promise<string> {
		try {
			const { humanity, agent } = await this.#arena.report(report);
			return `Humanity ${humanity} : ${agent} ${model}.`;
		} catch (reason) {
			return `The arena did not take this match: ${Error.from(reason).message}`;
		}
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

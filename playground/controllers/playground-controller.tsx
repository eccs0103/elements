"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SettingsService } from "../../settings/services/settings-service.js";
import { DeckService } from "../services/deck-service.js";
import { type Simulation } from "../services/simulation.js";
import { Challenge } from "../services/challenge.js";
import { PlaygroundApp } from "../view/playground-app.js";
import { Notice } from "../view/notice.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Entry, Start, Shortage, type Allowance, type Report, type Standing, type Ticket, type Verdict } from "../../arena/models/protocol.js";
import { type Element } from "../models/elements.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body, head } = document;
const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Playground controller
class PlaygroundController extends Controller {
	#arena: ArenaClient = new ArenaClient(globalThis, new URI("/", baseURI));
	#root: Root = createRoot(body.getElement(HTMLDivElement, "div#root"));
	#ticket: Ticket | null = null;

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();
		const { content } = deck;
		if (!content.full) return this.#show(Notice.unfinished(content.elements.length, content.capacity));
		this.#show(Notice.loading());
		try {
			const [ticket, standing] = await Promise.all([this.#open(content.elements), this.#arena.standing()]);
			const allowance = await this.#allowance();
			this.#ticket = ticket;
			this.#show(Notice.ready(standing, ticket, allowance));
		} catch (reason) {
			this.#show(await this.#refusal(Error.from(reason)));
		}
	}

	#show(notice: Notice): void {
		this.#root.render(<StrictMode><PlaygroundApp ticket={this.#ticket} notice={notice} onLaunch={this.#launch.bind(this)} onFinish={this.#finish.bind(this)} /></StrictMode>);
	}

	async #open(elements: Element[]): Promise<Ticket> {
		const challenge = new Challenge(body.getElement(HTMLDivElement, "div#gate"), head.getElement(HTMLScriptElement, "script#challenge"));
		return await this.#arena.open(new Entry(elements, await challenge.token()));
	}

	async #refusal(error: Error): Promise<Notice> {
		if (!(error instanceof Shortage)) return Notice.trouble(error);
		try {
			return Notice.shortage(await this.#arena.allowance());
		} catch (reason) {
			return Notice.trouble(Error.from(reason));
		}
	}

	#launch(simulation: Simulation): void {
		this.#show(Notice.playing());
		void this.#start(simulation);
	}

	async #start(simulation: Simulation): Promise<void> {
		const { ticket } = simulation;
		if (ticket === null) return;
		try {
			simulation.start(await this.#arena.start(new Start(ticket.id)));
		} catch (reason) {
			this.#show(Notice.trouble(Error.from(reason)));
		}
	}

	#finish(simulation: Simulation): void {
		const { ticket, report, verdict } = simulation;
		if (ticket === null || report === null || verdict === null) return;
		this.#show(Notice.judging(verdict, ticket));
		void this.#judge(ticket, report, verdict);
	}

	async #judge(ticket: Ticket, report: Report, verdict: Verdict): Promise<void> {
		const arena = this.#arena;
		let standing: Standing;
		try {
			standing = await arena.report(report);
		} catch (reason) {
			return this.#show(Notice.uncounted(verdict, ticket, Error.from(reason)));
		}
		this.#show(Notice.outcome(verdict, ticket, standing, await this.#allowance()));
	}

	async #allowance(): Promise<Allowance | null> {
		try {
			return await this.#arena.allowance();
		} catch (reason) {
			console.error(`The allowance did not load:\n${Error.from(reason)}`);
			return null;
		}
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SettingsService } from "../../settings/services/settings-service.js";
import { Mode } from "../../settings/models/settings.js";
import { DeckService } from "../services/deck-service.js";
import { type Simulation } from "../services/simulation.js";
import { Challenge } from "../services/challenge.js";
import { PlaygroundApp } from "../view/playground-app.js";
import { Notice } from "../view/notice.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Entry, Start, Shortage, Ticket, type Allowance, type Report, type Verdict } from "../../arena/models/protocol.js";
import { AgentCatalog, type AgentModel } from "../models/agent-catalog.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body, head } = document;
const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Duel
class Duel {
	#model: AgentModel;
	#weights: URI;
	#client: ArenaClient = new ArenaClient(globalThis, new URI("/", baseURI));
	#root: Root = createRoot(body.getElement(HTMLDivElement, "div#root"));
	#mode: Mode = settings.content.mode;
	#online: boolean | null = null;
	#arena: Notice = Notice.connecting();
	#practice: Notice = Notice.loading();
	#playing: boolean = false;
	#opening: boolean = false;
	#switchable: boolean = true;
	#lobby: Ticket | null = null;
	#drill: Ticket | null = null;
	#ticket: Ticket | null = null;

	constructor(model: AgentModel, weights: URI) {
		this.#model = model;
		this.#weights = weights;
	}

	async open(): Promise<void> {
		const { content } = deck;
		if (!content.full) {
			this.#switchable = false;
			this.#arena = this.#practice = Notice.unfinished(content.elements.length, content.capacity);
			return this.#show();
		}
		const drill = this.#deal();
		if (this.#mode === Mode.practice) this.#ticket = drill;
		this.#show();
		await this.#connect();
	}

	#show(): void {
		const mode = this.#mode;
		const arena = this.#arena;
		const practice = this.#practice;
		const notice = mode === Mode.arena ? arena : practice;
		this.#root.render(
			<StrictMode>
				<PlaygroundApp model={this.#model} weights={this.#weights} ticket={this.#ticket} mode={mode} online={this.#online} arena={arena} practice={practice} playing={this.#playing} switchable={this.#switchable} ready={notice.playable} onSwitch={this.#switch.bind(this)} onAgain={this.#again.bind(this)} onLaunch={this.#launch.bind(this)} onFinish={this.#finish.bind(this)} />
			</StrictMode>
		);
	}

	#deal(): Ticket {
		const ticket = this.#drill = Ticket.deal(crypto.randomUUID(), Duel.#number(), Duel.#number(), deck.content.elements);
		this.#practice = Notice.practice(ticket, this.#model);
		return ticket;
	}

	async #connect(): Promise<void> {
		this.#online = null;
		this.#show();
		try {
			await this.#client.standing();
		} catch (reason) {
			console.error(`The arena is offline:\n${Error.from(reason)}`);
			this.#online = false;
			if (this.#mode === Mode.arena) {
				this.#mode = Mode.practice;
				this.#ticket = this.#drill ?? this.#deal();
			}
			return this.#show();
		}
		this.#online = true;
		this.#show();
		if (this.#mode === Mode.arena) await this.#enter();
	}

	async #switch(mode: Mode): Promise<void> {
		if (mode === this.#mode || this.#playing) return;
		if (mode === Mode.arena && this.#online !== true) return;
		this.#mode = mode;
		settings.content.mode = mode;
		if (mode === Mode.practice) {
			this.#ticket = this.#drill ?? this.#deal();
			this.#show();
		} else {
			void this.#enter();
		}
		await settings.save();
	}

	async #enter(): Promise<void> {
		const lobby = this.#lobby;
		if (lobby !== null) {
			this.#ticket = lobby;
			return this.#show();
		}
		if (this.#opening) return this.#show();
		this.#opening = true;
		this.#arena = Notice.loading();
		this.#show();
		try {
			const client = this.#client;
			const [ticket, standing] = await Promise.all([this.#open(), client.standing()]);
			const allowance = await this.#allowance();
			this.#lobby = ticket;
			this.#arena = Notice.ready(standing, ticket, this.#model, allowance);
			if (this.#mode === Mode.arena) this.#ticket = ticket;
		} catch (reason) {
			this.#arena = await this.#refusal(Error.from(reason));
		}
		this.#opening = false;
		this.#show();
	}

	async #open(): Promise<Ticket> {
		const challenge = new Challenge(body.getElement(HTMLDivElement, "div#gate"), head.getElement(HTMLScriptElement, "script#challenge"));
		return await this.#client.open(new Entry(deck.content.elements, await challenge.token()));
	}

	async #refusal(error: Error): Promise<Notice> {
		if (!(error instanceof Shortage)) return Notice.trouble(error);
		try {
			return Notice.shortage(await this.#client.allowance());
		} catch (reason) {
			return Notice.trouble(Error.from(reason));
		}
	}

	async #again(): Promise<void> {
		if (this.#mode === Mode.arena) return await this.#enter();
		this.#ticket = this.#deal();
		this.#show();
		if (this.#online === false) await this.#connect();
	}

	#launch(simulation: Simulation): void {
		this.#playing = true;
		this.#show();
		if (this.#mode === Mode.practice) {
			this.#drill = null;
			return;
		}
		this.#lobby = null;
		void this.#start(simulation);
	}

	async #start(simulation: Simulation): Promise<void> {
		const { ticket } = simulation;
		if (ticket === null) return;
		try {
			simulation.start(await this.#client.start(new Start(ticket.id)));
		} catch (reason) {
			this.#playing = false;
			this.#arena = Notice.trouble(Error.from(reason));
			this.#show();
		}
	}

	#finish(simulation: Simulation): void {
		const { ticket, report, verdict } = simulation;
		if (ticket === null || report === null || verdict === null) return;
		this.#playing = false;
		if (this.#mode === Mode.practice) {
			this.#practice = Notice.practiced(verdict, ticket, this.#model);
			return this.#show();
		}
		this.#arena = Notice.judging(verdict, ticket, this.#model);
		this.#show();
		void this.#judge(ticket, report, verdict);
	}

	async #judge(ticket: Ticket, report: Report, verdict: Verdict): Promise<void> {
		const client = this.#client;
		const model = this.#model;
		try {
			const standing = await client.report(report);
			this.#arena = Notice.outcome(verdict, ticket, model, standing, await this.#allowance());
		} catch (reason) {
			this.#arena = Notice.uncounted(verdict, ticket, model, Error.from(reason));
		}
		this.#show();
	}

	async #allowance(): Promise<Allowance | null> {
		try {
			return await this.#client.allowance();
		} catch (reason) {
			console.error(`The allowance did not load:\n${Error.from(reason)}`);
			return null;
		}
	}

	static #number(): number {
		const [value] = crypto.getRandomValues(new Uint32Array(1));
		return value >>> 1;
	}
}
//#endregion
//#region Playground controller
class PlaygroundController extends Controller {
	static #source: URI = new URI("../models.json", baseURI);

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();
		const source = PlaygroundController.#source;
		const response = await fetch(source.href);
		if (!response.ok) throw new ReferenceError(`The agent catalog could not load (${response.status})`);
		const model = AgentCatalog.import(await response.json(), "catalog").first;
		await new Duel(model, model.weights(source)).open();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

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
	#catalog: URI;
	#client: ArenaClient = new ArenaClient(globalThis, new URI("/", baseURI));
	#root: Root = createRoot(body.getElement(HTMLDivElement, "div#root"));
	#mode: Mode = settings.content.mode;
	#model: AgentModel | null = null;
	#online: boolean | null = null;
	#allowance: Allowance | null = null;
	#arena: Notice = Notice.connecting();
	#practice: Notice = Notice.loading();
	#playing: boolean = false;
	#finished: boolean = false;
	#opening: boolean = false;
	#switchable: boolean = true;
	#lobby: Ticket | null = null;
	#drill: Ticket | null = null;

	constructor(catalog: URI) {
		this.#catalog = catalog;
	}

	async open(): Promise<void> {
		const { content } = deck;
		if (!content.full) {
			this.#switchable = false;
			this.#arena = this.#practice = Notice.unfinished(content.elements.length, content.capacity);
			return this.#show();
		}
		this.#show();
		this.#model = await this.#load();
		this.#deal();
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
				<PlaygroundApp catalog={this.#catalog} ticket={this.#drill} mode={mode} online={this.#online} allowance={this.#allowance} arena={arena} practice={practice} playing={this.#playing} switchable={this.#switchable} ready={notice.playable} onSwitch={this.#switch.bind(this)} onAgain={this.#again.bind(this)} onLaunch={this.#launch.bind(this)} onFinish={this.#finish.bind(this)} onFailure={this.#fail.bind(this)} />
			</StrictMode>
		);
	}

	async #load(): Promise<AgentModel> {
		const response = await fetch(this.#catalog.href);
		if (!response.ok) throw new ReferenceError(`The agent catalog could not load (${response.status})`);
		return AgentCatalog.import(await response.json(), "catalog").first;
	}

	#deal(): void {
		const model = ReferenceError.suppress(this.#model, "The agent catalog has not loaded yet");
		const drill = this.#drill = Ticket.deal(crypto.randomUUID(), Duel.#number(), Duel.#number(), deck.content.elements, model);
		this.#practice = Notice.practice(drill);
		this.#finished = false;
	}

	async #connect(): Promise<void> {
		this.#online = null;
		this.#show();
		try {
			await this.#client.standing();
		} catch (reason) {
			console.error(`The arena is offline:\n${Error.from(reason)}`);
			this.#online = false;
			if (this.#mode === Mode.arena) this.#mode = Mode.practice;
			return this.#show();
		}
		this.#online = true;
		this.#allowance = await this.#tickets();
		this.#show();
		if (this.#mode === Mode.arena) await this.#enter();
	}

	async #switch(mode: Mode): Promise<void> {
		if (mode === this.#mode || this.#playing) return;
		if (mode === Mode.arena && this.#online !== true) return;
		this.#mode = mode;
		settings.content.mode = mode;
		if (this.#finished) this.#deal();
		this.#show();
		if (mode === Mode.arena) void this.#enter();
		await settings.save();
	}

	async #enter(): Promise<void> {
		if (this.#lobby !== null || this.#opening) return this.#show();
		this.#opening = true;
		this.#arena = Notice.loading();
		this.#show();
		try {
			const [ticket, standing] = await Promise.all([this.#open(), this.#client.standing()]);
			const allowance = this.#allowance = await this.#tickets();
			this.#lobby = ticket;
			this.#arena = allowance !== null && allowance.left < 1 ? Notice.shortage(allowance) : Notice.ready(standing, ticket);
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
			const allowance = this.#allowance = await this.#client.allowance();
			return Notice.shortage(allowance);
		} catch (reason) {
			return Notice.trouble(Error.from(reason));
		}
	}

	async #again(): Promise<void> {
		this.#deal();
		this.#show();
		if (this.#mode === Mode.arena) return await this.#enter();
		if (this.#online === false) await this.#connect();
	}

	#launch(simulation: Simulation): void {
		const drill = ReferenceError.suppress(this.#drill, "There is no match to start");
		this.#playing = true;
		this.#show();
		if (this.#mode === Mode.practice) return simulation.start(drill);
		void this.#start(simulation, drill);
	}

	async #start(simulation: Simulation, drill: Ticket): Promise<void> {
		try {
			const lobby = ReferenceError.suppress(this.#lobby, "The arena match is not ready yet");
			const luck = ReferenceError.suppress(drill.luck, "The match has no luck to play with");
			this.#lobby = null;
			simulation.start(await this.#client.start(new Start(lobby.id, luck)));
		} catch (reason) {
			simulation.show(drill);
			this.#playing = false;
			this.#arena = await this.#refusal(Error.from(reason));
			this.#show();
		}
	}

	#finish(simulation: Simulation): void {
		const { ticket, report, verdict } = simulation;
		if (ticket === null || report === null || verdict === null) return;
		this.#playing = false;
		this.#finished = true;
		if (this.#mode === Mode.practice) {
			this.#practice = Notice.practiced(verdict, ticket);
			return this.#show();
		}
		this.#arena = Notice.judging(verdict, ticket);
		this.#show();
		void this.#judge(ticket, report, verdict);
	}

	#fail(message: string): void {
		this.#playing = false;
		const notice = Notice.trouble(new Error(message));
		if (this.#mode === Mode.arena) this.#arena = notice;
		else this.#practice = notice;
		this.#show();
	}

	async #judge(ticket: Ticket, report: Report, verdict: Verdict): Promise<void> {
		try {
			const standing = await this.#client.report(report);
			const allowance = this.#allowance = await this.#tickets();
			this.#arena = Notice.outcome(verdict, ticket, standing, allowance);
		} catch (reason) {
			this.#arena = Notice.uncounted(verdict, ticket, Error.from(reason));
		}
		this.#show();
	}

	async #tickets(): Promise<Allowance | null> {
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
	static #catalog: URI = new URI("../models.json", baseURI);

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();
		await new Duel(PlaygroundController.#catalog).open();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

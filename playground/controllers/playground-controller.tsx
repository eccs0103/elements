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
	static #catalog: URI = new URI("../models.json", baseURI);
	#client: ArenaClient = new ArenaClient(new URI("/", baseURI));
	#root: Root = createRoot(body.getElement(HTMLDivElement, "div#root"));
	#mode: Mode = settings.content.mode;
	#model: AgentModel | null = null;
	#online: boolean | null = null;
	#allowance: Allowance | null = null;
	#arena: Notice = Notice.connecting();
	#practice: Notice = Notice.preparing();
	#playing: boolean = false;
	#opening: boolean = false;
	#switchable: boolean = true;
	#tutorial: boolean = !settings.content.tutored;
	#lobby: Ticket | null = null;
	#drill: Ticket | null = null;
	#refill: number | null = null;
	#last: Notice | null = null;

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
		this.#root.render(
			<StrictMode>
				<PlaygroundApp catalog={Duel.#catalog}ticket={this.#drill} mode={this.#mode} online={this.#online} allowance={this.#allowance} arena={this.#arena} practice={this.#practice} playing={this.#playing} switchable={this.#switchable} tutorial={this.#tutorial} onSwitch={this.#switch.bind(this)} onAgain={this.#again.bind(this)} onLearn={this.#learn.bind(this)} onTeach={this.#teach.bind(this)} onLaunch={this.#launch.bind(this)} onFinish={this.#finish.bind(this)} onFailure={this.#fail.bind(this)} />
			</StrictMode>
		);
	}

	#teach(): void {
		this.#tutorial = true;
		this.#show();
	}

	async #learn(): Promise<void> {
		this.#tutorial = false;
		this.#show();
		settings.content.tutored = true;
		await settings.save();
	}

	// Not simplified: ArenaRouter.#model fetches the same catalog, but AgentCatalog is core and fetch is not.
	async #load(): Promise<AgentModel> {
		const response = await fetch(Duel.#catalog.href);
		if (!response.ok) throw new ReferenceError(`The agent catalog could not load (${response.status})`);
		return AgentCatalog.import(await response.json(), "catalog").first;
	}

	#deal(): void {
		const model = ReferenceError.suppress(this.#model, "The agent catalog has not loaded yet");
		const drill = this.#drill = Ticket.deal(crypto.randomUUID(), Duel.#number(), Duel.#number(), deck.content.elements, model);
		this.#practice = Notice.practice(drill);
	}

	async #connect(): Promise<void> {
		this.#online = null;
		this.#show();
		const tickets = this.#tickets();
		try {
			await this.#client.standing();
		} catch (reason) {
			console.error(`The arena is offline:\n${Error.from(reason)}`);
			this.#online = false;
			if (this.#mode === Mode.arena) this.#mode = Mode.practice;
			return this.#show();
		}
		this.#online = true;
		this.#allowance = await tickets;
		this.#show();
		if (this.#mode === Mode.arena) await this.#enter();
	}

	async #switch(mode: Mode): Promise<void> {
		if (mode === this.#mode || this.#playing) return;
		if (mode === Mode.arena && this.#online !== true) return;
		this.#mode = mode;
		settings.content.mode = mode;
		this.#show();
		if (mode === Mode.arena) void this.#enter();
		await settings.save();
	}

	async #enter(): Promise<void> {
		if (this.#lobby !== null || this.#opening) return this.#show();
		this.#opening = true;
		const last = this.#last;
		this.#arena = last === null ? Notice.loading() : last.next();
		this.#show();
		try {
			this.#arena = await this.#admit(last);
		} catch (reason) {
			this.#arena = await this.#refusal(Error.from(reason));
		}
		this.#opening = false;
		this.#show();
	}

	async #admit(last: Notice | null): Promise<Notice> {
		const allowance = this.#allowance = await this.#tickets();
		if (allowance !== null && allowance.left < 1) return this.#waiting(allowance);
		const [ticket, standing] = await Promise.all([this.#open(), this.#client.standing()]);
		this.#lobby = ticket;
		return last === null ? Notice.ready(standing, ticket) : last.again();
	}

	async #open(): Promise<Ticket> {
		const challenge = new Challenge(body.getElement(HTMLDialogElement, "dialog#gate"), head.getElement(HTMLScriptElement, "script#challenge"));
		return await this.#client.open(new Entry(deck.content.elements, await challenge.token()));
	}

	async #refusal(error: Error): Promise<Notice> {
		if (!(error instanceof Shortage)) return Notice.trouble(error);
		try {
			const allowance = this.#allowance = await this.#client.allowance();
			this.#schedule(allowance);
			return this.#waiting(allowance);
		} catch (reason) {
			return Notice.trouble(Error.from(reason));
		}
	}

	#waiting(allowance: Allowance): Notice {
		const last = this.#last;
		return last === null ? Notice.shortage(allowance) : last.wait(allowance);
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
		this.#last = null;
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
			this.#allowance = await this.#tickets();
			this.#show();
		} catch (reason) {
			simulation.show(drill);
			this.#playing = false;
			this.#arena = await this.#refusal(Error.from(reason));
			this.#show();
		}
	}

	#finish(simulation: Simulation): void {
		const { ticket, finish } = simulation;
		if (ticket === null || finish === null) return;
		const { report, verdict } = finish;
		this.#playing = false;
		this.#deal();
		if (this.#mode === Mode.practice) {
			this.#practice = Notice.practiced(verdict, ticket).again();
			return this.#show();
		}
		this.#arena = Notice.outcome(verdict, ticket).saving();
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
		let last = Notice.outcome(verdict, ticket);
		try {
			await this.#client.report(report);
		} catch (reason) {
			last = Notice.uncounted(verdict, ticket, Error.from(reason));
		}
		this.#last = last;
		this.#arena = last.next();
		if (this.#mode !== Mode.arena) return this.#show();
		await this.#enter();
	}

	async #tickets(): Promise<Allowance | null> {
		try {
			const allowance = await this.#client.allowance();
			this.#schedule(allowance);
			return allowance;
		} catch (reason) {
			console.error(`The allowance did not load:\n${Error.from(reason)}`);
			return null;
		}
	}

	#schedule(allowance: Allowance): void {
		const refill = this.#refill;
		if (refill !== null) clearTimeout(refill);
		this.#refill = null;
		if (allowance.wait <= 0) return;
		this.#refill = setTimeout(this.#restore.bind(this), allowance.wait);
	}

	async #restore(): Promise<void> {
		const allowance = await this.#tickets();
		if (allowance === null) return;
		this.#allowance = allowance;
		this.#show();
		if (this.#mode !== Mode.arena || this.#playing || this.#lobby !== null) return;
		await this.#enter();
	}

	// Not simplified: Arena.#number is the same, but crypto is not in core, so no core model can own one shared copy; Random.global would change the entropy source.
	static #number(): number {
		const [value] = crypto.getRandomValues(new Uint32Array(1));
		return value >>> 1;
	}
}
//#endregion
//#region Playground controller
class PlaygroundController extends Controller {
	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();
		await new Duel().open();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

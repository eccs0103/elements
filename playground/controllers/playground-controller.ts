"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";
import { SettingsService } from "../../settings/services/settings-service.js";
import { DeckService } from "../services/deck-service.js";
import { Simulation } from "../services/simulation.js";
import { Tray } from "../view/tray.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Entry } from "../../arena/models/protocol.js";
import { Relay } from "../../arena/services/relay.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI } = document;
const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Playground controller
class PlaygroundController extends Controller {
	#canvasBoard: HTMLCanvasElement = document.getElement(HTMLCanvasElement, "canvas#board");
	#divHand: HTMLDivElement = document.getElement(HTMLDivElement, "div#hand");
	#arena: ArenaClient = new ArenaClient(new Relay(), new URI("/", baseURI));
	#simulation: Simulation;

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.content.apply();
		const { content } = deck;
		if (!content.full) return this.#complete(content.elements.length, content.capacity);

		const canvasBoard = this.#canvasBoard;
		const simulation = this.#simulation = new Simulation(canvasBoard);
		const tray = new Tray(this.#divHand, canvasBoard, simulation);
		simulation.addEventListener("update", event => tray.render());
		simulation.addEventListener("finish", event => void this.#guard(this.#judge()));
		simulation.start(await this.#arena.open(new Entry(content.elements)));
	}

	#complete(count: number, capacity: number): void {
		if (!window.confirm(`Your deck holds ${count} of ${capacity} elements.\nOpen Settings to finish it?`)) return;
		location.assign(new URI("../settings/", baseURI).href);
	}

	async #guard(task: Promise<void>): Promise<void> {
		try {
			await task;
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	}

	async #judge(): Promise<void> {
		const { ticket, report } = this.#simulation;
		if (ticket === null || report === null) return;
		const arena = this.#arena;
		const verdict = await arena.judge(report);
		const { humanity, boss } = await arena.standing();
		const { human } = ticket;
		const { winner, scores } = verdict;
		const mine = scores[human];
		const theirs = scores.reduce((sum, score) => sum + score, 0) - mine;
		let outcome = "Draw";
		if (winner === human) outcome = "You won";
		else if (winner !== null) outcome = "The boss won";
		if (!window.confirm(`${outcome} ${mine} : ${theirs}.\nHumanity ${humanity} : ${boss} Boss.\nPlay again?`)) return;
		location.reload();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

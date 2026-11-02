"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { SettingsService } from "../../settings/services/settings-service.js";
import { Simulation } from "../services/simulation.js";
import { Tray } from "../view/tray.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Relay } from "../../arena/services/relay.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI } = document;

//#region Playground controller
class PlaygroundController extends Controller {
	#canvasBoard: HTMLCanvasElement = document.getElement(HTMLCanvasElement, "canvas#board");
	#inputTogglePlay: HTMLInputElement = document.getElement(HTMLInputElement, "input#toggle-play");
	#buttonReloadBoard: HTMLButtonElement = document.getElement(HTMLButtonElement, "button#reload-board");
	#divHand: HTMLDivElement = document.getElement(HTMLDivElement, "div#hand");
	#arena: ArenaClient = new ArenaClient(new Relay(), new URL("/", baseURI));
	#simulation: Simulation;

	async run(): Promise<void> {
		void AnalyticsController.launch();
		SettingsService.instance.content.apply();

		const canvasBoard = this.#canvasBoard;
		const simulation = this.#simulation = new Simulation(canvasBoard);
		const tray = new Tray(this.#divHand, canvasBoard, simulation);
		simulation.addEventListener("update", event => tray.render());
		simulation.addEventListener("finish", event => void this.#conclude());

		const inputTogglePlay = this.#inputTogglePlay;
		inputTogglePlay.addEventListener("change", event => simulation.launched = inputTogglePlay.checked);
		this.#buttonReloadBoard.addEventListener("click", event => void this.#restart());
		await this.#begin();
	}

	async #begin(): Promise<void> {
		const simulation = this.#simulation;
		simulation.launched = false;
		this.#inputTogglePlay.checked = false;
		simulation.start(await this.#arena.open());
	}

	async #restart(): Promise<void> {
		try {
			await this.#begin();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	}

	async #conclude(): Promise<void> {
		try {
			await this.#judge();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	}

	async #judge(): Promise<void> {
		const simulation = this.#simulation;
		const inputTogglePlay = this.#inputTogglePlay;
		const { ticket, report } = simulation;
		inputTogglePlay.checked = false;
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
		await this.#begin();
		simulation.launched = true;
		inputTogglePlay.checked = true;
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await PlaygroundController.launch();

"use strict";

import "adaptive-extender/web";
import { Controller, FastEngine, Color } from "adaptive-extender/web";
import { Cycle } from "../../settings/models/settings.js";
import { SettingsService } from "../../settings/services/settings-service.js";
import { Simulation } from "../services/simulation.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const settings = SettingsService.instance;

//#region Sandbox controller
class SandboxController extends Controller {
	static #refresh: number = 4;
	#canvasBoard: HTMLCanvasElement = document.getElement(HTMLCanvasElement, "canvas#board");
	#inputTogglePlay: HTMLInputElement = document.getElement(HTMLInputElement, "input#toggle-play");
	#buttonReloadBoard: HTMLButtonElement = document.getElement(HTMLButtonElement, "button#reload-board");
	#buttonCaptureCanvas: HTMLButtonElement = document.getElement(HTMLButtonElement, "button#capture-canvas");
	#outputTickCounter: HTMLOutputElement = document.getElement(HTMLOutputElement, "output#tick-counter");
	#simulation: Simulation;

	async run(): Promise<void> {
		void AnalyticsController.launch();
		const { content } = settings;
		content.apply();

		const simulation = this.#simulation = new Simulation(this.#canvasBoard, content.size, content.speed);
		const inputTogglePlay = this.#inputTogglePlay;
		inputTogglePlay.addEventListener("change", event => simulation.launched = inputTogglePlay.checked);
		this.#buttonReloadBoard.addEventListener("click", event => simulation.generate());
		this.#buttonCaptureCanvas.addEventListener("click", event => void this.#capture());
		simulation.addEventListener("stall", event => this.#stall());

		const outputTickCounter = this.#outputTickCounter;
		outputTickCounter.hidden = !content.counter;
		if (!content.counter) return;
		const engine = new FastEngine();
		engine.limit = SandboxController.#refresh;
		engine.addEventListener("trigger", event => this.#count());
	}

	#count(): void {
		const { rate, speed } = this.#simulation;
		const outputTickCounter = this.#outputTickCounter;
		const factor = Math.min(rate / speed, 1);
		if (factor > 0) outputTickCounter.style.setProperty("--color-indicator", Color.fromHSL(factor * 120, 100, 50).toString());
		else outputTickCounter.style.removeProperty("--color-indicator");
		outputTickCounter.textContent = `${rate.toFixed()}`;
	}

	#stall(): void {
		const simulation = this.#simulation;
		const inputTogglePlay = this.#inputTogglePlay;
		simulation.launched = false;
		inputTogglePlay.checked = false;
		if (!this.#repeat()) return;
		simulation.generate();
		simulation.launched = true;
		inputTogglePlay.checked = true;
	}

	#repeat(): boolean {
		const { cycle } = settings.content;
		switch (cycle) {
		case Cycle.terminate: return false;
		case Cycle.ask: return window.confirm("Elements have no more moves. Do you want to reload the board?");
		case Cycle.repeat: return true;
		default: throw new TypeError(`Invalid '${cycle}' cycle`);
		}
	}

	async #capture(): Promise<void> {
		const picture = await this.#simulation.capture();
		const url = URL.createObjectURL(picture);
		const aDownload = document.createElement("a");
		aDownload.href = url;
		aDownload.download = `${Date.now()}.png`;
		aDownload.click();
		URL.revokeObjectURL(url);
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await SandboxController.launch();

"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { SettingsService } from "../../settings/services/settings-service.js";
import { Simulation } from "../services/simulation.js";
import { Picker } from "../view/picker.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { trunc } = Math;

//#region Sandbox controller
class SandboxController extends Controller {
	#canvasBoard: HTMLCanvasElement = document.getElement(HTMLCanvasElement, "canvas#board");
	#inputTogglePlay: HTMLInputElement = document.getElement(HTMLInputElement, "input#toggle-play");
	#buttonReloadBoard: HTMLButtonElement = document.getElement(HTMLButtonElement, "button#reload-board");
	#divPicker: HTMLDivElement = document.getElement(HTMLDivElement, "div#picker");
	#simulation: Simulation;
	#picker: Picker;
	#last: number | null = null;

	async run(): Promise<void> {
		void AnalyticsController.launch();
		SettingsService.instance.content.apply();

		const canvasBoard = this.#canvasBoard;
		const simulation = this.#simulation = new Simulation(canvasBoard);
		this.#picker = new Picker(this.#divPicker);
		const inputTogglePlay = this.#inputTogglePlay;
		inputTogglePlay.addEventListener("change", event => simulation.launched = inputTogglePlay.checked);
		this.#buttonReloadBoard.addEventListener("click", event => simulation.generate());

		canvasBoard.addEventListener("pointerdown", (event) => {
			canvasBoard.setPointerCapture(event.pointerId);
			this.#drop(event);
		});
		canvasBoard.addEventListener("pointermove", (event) => {
			if (!canvasBoard.hasPointerCapture(event.pointerId)) return;
			this.#drop(event);
		});
		canvasBoard.addEventListener("pointerup", event => this.#last = null);
		canvasBoard.addEventListener("pointercancel", event => this.#last = null);
	}

	#drop(event: PointerEvent): void {
		const size = Simulation.size;
		const { left, top, width, height } = this.#canvasBoard.getBoundingClientRect();
		const x = trunc((event.clientX - left) / width * size);
		const y = trunc((event.clientY - top) / height * size);
		if (x < 0 || x >= size || y < 0 || y >= size) return;
		const cell = y * size + x;
		if (cell === this.#last) return;
		this.#last = cell;
		this.#simulation.drop(this.#picker.selected, x, y);
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await SandboxController.launch();

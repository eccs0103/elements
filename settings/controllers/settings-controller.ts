"use strict";

import "adaptive-extender/web";
import { Controller, Enum } from "adaptive-extender/web";
import { Settings, Scheme, Cycle } from "../models/settings.js";
import { SettingsService } from "../services/settings-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const settings = SettingsService.instance;

//#region Settings controller
class SettingsController extends Controller {
	#selectScheme: HTMLSelectElement = document.getElement(HTMLSelectElement, "select#scheme");
	#inputCounter: HTMLInputElement = document.getElement(HTMLInputElement, "input#counter");
	#inputSpeed: HTMLInputElement = document.getElement(HTMLInputElement, "input#speed");
	#inputSize: HTMLInputElement = document.getElement(HTMLInputElement, "input#size");
	#selectCycle: HTMLSelectElement = document.getElement(HTMLSelectElement, "select#cycle");
	#buttonReset: HTMLButtonElement = document.getElement(HTMLButtonElement, "button#reset");

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.content.apply();
		const inputSpeed = this.#inputSpeed;
		const inputSize = this.#inputSize;
		this.#limit(inputSpeed, Settings.slowest, Settings.fastest);
		this.#limit(inputSize, Settings.smallest, Settings.largest);
		this.#show();

		this.#selectScheme.addEventListener("change", event => this.#rescheme());
		this.#inputCounter.addEventListener("change", event => this.#recount());
		inputSpeed.addEventListener("change", event => this.#respeed());
		inputSize.addEventListener("change", event => this.#resize());
		this.#selectCycle.addEventListener("change", event => this.#recycle());
		this.#buttonReset.addEventListener("click", event => this.#reset());
	}

	#limit(input: HTMLInputElement, minimum: number, maximum: number): void {
		input.min = `${minimum}`;
		input.max = `${maximum}`;
		input.placeholder = `[${minimum} - ${maximum}]`;
	}

	#show(): void {
		const { content } = settings;
		this.#selectScheme.value = content.scheme;
		this.#inputCounter.checked = content.counter;
		this.#inputSpeed.value = `${content.speed}`;
		this.#inputSize.value = `${content.size}`;
		this.#selectCycle.value = content.cycle;
	}

	async #save(): Promise<void> {
		try {
			await settings.save();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	}

	#rescheme(): void {
		const { content } = settings;
		content.scheme = Enum.Of(Scheme).import(this.#selectScheme.value, "scheme");
		content.apply();
		void this.#save();
	}

	#recount(): void {
		settings.content.counter = this.#inputCounter.checked;
		void this.#save();
	}

	#respeed(): void {
		const input = this.#inputSpeed;
		if (!input.checkValidity()) return;
		settings.content.speed = input.valueAsNumber;
		void this.#save();
	}

	#resize(): void {
		const input = this.#inputSize;
		if (!input.checkValidity()) return;
		settings.content.size = input.valueAsNumber;
		void this.#save();
	}

	#recycle(): void {
		settings.content.cycle = Enum.Of(Cycle).import(this.#selectCycle.value, "cycle");
		void this.#save();
	}

	#reset(): void {
		if (!window.confirm("The settings will be reset to their defaults. Are you sure?")) return;
		settings.reset();
		settings.content.apply();
		this.#show();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await SettingsController.launch();

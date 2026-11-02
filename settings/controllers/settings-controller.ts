"use strict";

import "adaptive-extender/web";
import { Controller, Enum } from "adaptive-extender/web";
import { Scheme } from "../models/settings.js";
import { SettingsService } from "../services/settings-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const settings = SettingsService.instance;

//#region Settings controller
class SettingsController extends Controller {
	#selectScheme: HTMLSelectElement = document.getElement(HTMLSelectElement, "select#scheme");

	async run(): Promise<void> {
		void AnalyticsController.launch();
		const { content } = settings;
		content.apply();
		const selectScheme = this.#selectScheme;
		selectScheme.value = content.scheme;
		selectScheme.addEventListener("change", event => void this.#rescheme());
	}

	async #rescheme(): Promise<void> {
		const { content } = settings;
		content.scheme = Enum.Of(Scheme).import(this.#selectScheme.value, "scheme");
		content.apply();
		try {
			await settings.save();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await SettingsController.launch();

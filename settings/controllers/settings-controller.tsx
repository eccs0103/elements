"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsService } from "../services/settings-service.js";
import { SettingsApp } from "../view/settings-app.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { body } = document;
const settings = SettingsService.instance;

//#region Settings controller
class SettingsController extends Controller {
	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();

		const divRoot = body.getElement(HTMLDivElement, "div#root");
		createRoot(divRoot).render(<StrictMode><SettingsApp settings={settings} /></StrictMode>);
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await SettingsController.launch();

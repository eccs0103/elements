"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SettingsService } from "../../settings/services/settings-service.js";
import { DeckService } from "../../playground/services/deck-service.js";
import { DeckApp } from "../view/deck-app.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { body } = document;
const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Deck controller
class DeckController extends Controller {
	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.content.apply();

		const divRoot = body.getElement(HTMLDivElement, "div#root");
		createRoot(divRoot).render(<StrictMode><DeckApp deck={deck} /></StrictMode>);
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await DeckController.launch();

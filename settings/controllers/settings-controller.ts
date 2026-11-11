"use strict";

import "adaptive-extender/web";
import { Controller, Enum } from "adaptive-extender/web";
import { Scheme } from "../models/settings.js";
import { SettingsService } from "../services/settings-service.js";
import { DeckBuilder } from "../view/deck-builder.js";
import { ElementDialog } from "../view/element-dialog.js";
import { DeckService } from "../../playground/services/deck-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const settings = SettingsService.instance;
const deck = DeckService.instance;

//#region Settings controller
class SettingsController extends Controller {
	#selectScheme: HTMLSelectElement = document.getElement(HTMLSelectElement, "select#scheme");
	#divDeck: HTMLDivElement = document.getElement(HTMLDivElement, "div#deck");
	#templateSlot: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#slot");
	#templateCard: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#card");
	#spanGhost: HTMLSpanElement = document.getElement(HTMLSpanElement, "span.ghost");
	#dialogDetails: HTMLDialogElement = document.getElement(HTMLDialogElement, "dialog#details");
	#templateRow: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#row");
	#templateChip: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#chip");

	async run(): Promise<void> {
		void AnalyticsController.launch();
		const { content } = settings;
		content.apply();
		const selectScheme = this.#selectScheme;
		selectScheme.value = content.scheme;
		selectScheme.addEventListener("change", event => void this.#rescheme());
		const details = new ElementDialog(deck, this.#dialogDetails, this.#templateRow, this.#templateChip);
		new DeckBuilder(deck, details, this.#divDeck, this.#templateSlot, this.#templateCard, this.#spanGhost);
	}

	async #rescheme(): Promise<void> {
		const { content } = settings;
		content.scheme = Enum.Of(Scheme).import(this.#selectScheme.value, "scheme");
		content.apply();
		await this.#save();
	}

	async #save(): Promise<void> {
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

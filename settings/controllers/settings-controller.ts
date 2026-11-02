"use strict";

import "adaptive-extender/web";
import { Controller, Enum } from "adaptive-extender/web";
import { Scheme } from "../models/settings.js";
import { Catalog, type Kind } from "../../playground/models/elements.js";
import { SettingsService } from "../services/settings-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const settings = SettingsService.instance;

//#region Settings controller
class SettingsController extends Controller {
	#selectScheme: HTMLSelectElement = document.getElement(HTMLSelectElement, "select#scheme");
	#divDeck: HTMLDivElement = document.getElement(HTMLDivElement, "div#deck");
	#templateCard: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#card");
	#inputs: Map<Kind, HTMLInputElement> = new Map();

	async run(): Promise<void> {
		void AnalyticsController.launch();
		const { content } = settings;
		content.apply();
		const selectScheme = this.#selectScheme;
		selectScheme.value = content.scheme;
		selectScheme.addEventListener("change", event => void this.#rescheme());
		const divDeck = this.#divDeck;
		for (const kind of Catalog.placeable) {
			divDeck.appendChild(this.#render(kind));
		}
		this.#refresh();
	}

	#render(kind: Kind): DocumentFragment {
		const element = Catalog.at(kind);
		const fragment = document.importNode(this.#templateCard.content, true);
		const id = `card-${kind}`;
		fragment.getElement(HTMLParagraphElement, "p.title").textContent = element.name;
		fragment.getElement(HTMLElement, "dfn.definition").textContent = element.reactions.map(reaction => reaction.name).join(", ");
		const inputCard = fragment.getElement(HTMLInputElement, "input[type=\"checkbox\"]");
		inputCard.id = id;
		fragment.getElement(HTMLLabelElement, "label.toggle").htmlFor = id;
		inputCard.addEventListener("change", event => void this.#toggle(kind, inputCard.checked));
		this.#inputs.set(kind, inputCard);
		return fragment;
	}

	#refresh(): void {
		const { content } = settings;
		for (const [kind, inputCard] of this.#inputs) {
			inputCard.checked = content.holds(kind);
			inputCard.disabled = content.locked(kind);
		}
	}

	async #toggle(kind: Kind, active: boolean): Promise<void> {
		settings.content.toggle(kind, active);
		this.#refresh();
		await this.#save();
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

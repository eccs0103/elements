"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { Catalog, type Element, type Reaction } from "../../sandbox/models/elements.js";
import { SettingsService } from "../../settings/services/settings-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

//#region Information controller
class InformationController extends Controller {
	#divElements: HTMLDivElement = document.getElement(HTMLDivElement, "div#elements");
	#templateElement: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#element");
	#templateAbility: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#ability");

	async run(): Promise<void> {
		void AnalyticsController.launch();
		SettingsService.instance.content.apply();
		const divElements = this.#divElements;
		for (const element of Catalog.elements) {
			if (divElements.childElementCount > 0) divElements.appendChild(this.#separate());
			divElements.appendChild(this.#render(element));
		}
	}

	#render(element: Element): DocumentFragment {
		const fragment = document.importNode(this.#templateElement.content, true);
		fragment.getElement(SVGRectElement, "svg.avatar rect").setAttribute("fill", element.color.toString());
		fragment.getElement(HTMLHeadingElement, "h2.name").textContent = element.name;
		const dlAbilities = fragment.getElement(HTMLElement, "dl.abilities");
		for (const reaction of element.reactions) {
			dlAbilities.appendChild(this.#describe(reaction));
		}
		return fragment;
	}

	#separate(): HTMLHRElement {
		const hrSeparator = document.createElement("hr");
		hrSeparator.classList.add("depth");
		return hrSeparator;
	}

	#describe(reaction: Reaction): DocumentFragment {
		const fragment = document.importNode(this.#templateAbility.content, true);
		fragment.getElement(HTMLElement, "dt.name").textContent = reaction.name;
		fragment.getElement(HTMLElement, "dd.preparation").textContent = `Preparation: ${reaction.interval} frame(s)`;
		fragment.getElement(HTMLElement, "dd.summary").textContent = reaction.description;
		return fragment;
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await InformationController.launch();

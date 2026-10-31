"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { Catalog, type Element, type Ability } from "../../sandbox/models/elements.js";
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
		fragment.getElement(HTMLElement, "dd.chance").textContent = `${(Catalog.chance(element) * 100).toFixed(2)}%`;
		const dlAbilities = fragment.getElement(HTMLElement, "dl.abilities");
		for (const ability of element.abilities) {
			dlAbilities.appendChild(this.#describe(ability));
		}
		return fragment;
	}

	#separate(): HTMLHRElement {
		const hrSeparator = document.createElement("hr");
		hrSeparator.classList.add("depth");
		return hrSeparator;
	}

	#describe(ability: Ability): DocumentFragment {
		const fragment = document.importNode(this.#templateAbility.content, true);
		fragment.getElement(HTMLElement, "dt.name").textContent = ability.name;
		fragment.getElement(HTMLElement, "dd.preparation").textContent = `Preparation: ${ability.preparation} tick(s)`;
		fragment.getElement(HTMLElement, "dd.summary").textContent = ability.description;
		return fragment;
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await InformationController.launch();

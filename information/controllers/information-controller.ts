"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { Catalog, type Element } from "../../sandbox/models/elements.js";
import { SettingsService } from "../../settings/services/settings-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

//#region Information controller
class InformationController extends Controller {
	#divElements: HTMLDivElement = document.getElement(HTMLDivElement, "div#elements");
	#templateElement: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#element");
	#templateProperty: HTMLTemplateElement = document.getElement(HTMLTemplateElement, "template#property");

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
		const dlProperties = fragment.getElement(HTMLElement, "dl.properties");
		for (const [label, value] of this.#properties(element)) {
			dlProperties.appendChild(this.#describe(label, value));
		}
		return fragment;
	}

	#separate(): HTMLHRElement {
		const hrSeparator = document.createElement("hr");
		hrSeparator.classList.add("depth");
		return hrSeparator;
	}

	*#properties(element: Element): Generator<readonly [string, string]> {
		const { phase, heat, spread, budget, fuel, lifetime, hot, cold, inertia } = element;
		yield ["Phase:", phase];
		yield ["Heat:", heat > 0 ? `+${heat}` : `${heat}`];
		if (spread !== null) yield ["Spreads:", `every ${spread} tick(s)`];
		if (budget > 0) yield ["Budget:", `${budget}`];
		if (fuel !== null) yield ["Fuel:", `${fuel} tick(s)`];
		if (lifetime !== null) yield ["Lifetime:", `${lifetime} tick(s)`];
		if (hot !== null) yield ["When hot:", Catalog.at(hot).name];
		if (cold !== null) yield ["When cold:", Catalog.at(cold).name];
		if (hot !== null || cold !== null) yield ["Inertia:", `${inertia}`];
	}

	#describe(label: string, value: string): DocumentFragment {
		const fragment = document.importNode(this.#templateProperty.content, true);
		fragment.getElement(HTMLElement, "dt.label").textContent = label;
		fragment.getElement(HTMLElement, "dd.value").textContent = value;
		return fragment;
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await InformationController.launch();

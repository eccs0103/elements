"use strict";

import "adaptive-extender/web";
import { type Element } from "../models/elements.js";

//#region Swatch
export class Swatch {
	static paint(target: HTMLElement, element: Element): void {
		const { style } = target;
		style.setProperty("--color", element.color.toString());
		style.setProperty("--faded", element.tint(0).toString());
	}

	static traits(ulTraits: HTMLUListElement, element: Element): HTMLLIElement {
		const { heat } = element;
		const liHeat = Swatch.#trait("heat", `Heat ${heat > 0 ? "+" : ""}${heat}`);
		ulTraits.replaceChildren(liHeat);
		if (element.flammable) ulTraits.appendChild(Swatch.#trait("flammable", "Flammable"));
		if (element.conductive) ulTraits.appendChild(Swatch.#trait("conductive", "Conducts"));
		return liHeat;
	}

	static #trait(kind: string, text: string): HTMLLIElement {
		const liTrait = document.createElement("li");
		liTrait.classList.add("trait", "depth", "rounded", "flex", "alt-center", "with-gap", "small-gap", "with-padding", "small-padding", "font-smaller-2", kind);
		const spanIcon = document.createElement("span");
		spanIcon.classList.add("icon");
		liTrait.append(spanIcon, document.createTextNode(text));
		return liTrait;
	}
}
//#endregion

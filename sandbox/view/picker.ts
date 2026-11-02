"use strict";

import "adaptive-extender/web";
import { Catalog, type Kind } from "../models/elements.js";

//#region Picker
export class Picker {
	#inputs: HTMLInputElement[] = [];

	constructor(container: HTMLElement) {
		const inputs = this.#inputs;
		const { elements } = Catalog;
		for (let kind = 0; kind < elements.length; kind++) {
			const { name, color } = elements[kind];
			const inputSwatch = document.createElement("input");
			inputSwatch.type = "radio";
			inputSwatch.name = "element";
			inputSwatch.id = `element-${kind}`;
			inputSwatch.hidden = true;
			inputSwatch.checked = kind === 0;
			const labelSwatch = document.createElement("label");
			labelSwatch.htmlFor = inputSwatch.id;
			labelSwatch.title = name;
			labelSwatch.classList.add("flex", "with-padding");
			const spanSwatch = document.createElement("span");
			spanSwatch.classList.add("swatch", "rounded");
			spanSwatch.style.setProperty("--color", color.toString());
			labelSwatch.appendChild(spanSwatch);
			container.append(inputSwatch, labelSwatch);
			inputs.push(inputSwatch);
		}
	}

	get selected(): Kind {
		const inputs = this.#inputs;
		for (let kind = 0; kind < inputs.length; kind++) {
			if (inputs[kind].checked) return kind;
		}
		throw new ReferenceError("No element is selected");
	}
}
//#endregion

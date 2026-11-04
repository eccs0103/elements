"use strict";

import "adaptive-extender/web";
import { type BufferedCell } from "adaptive-extender/web";
import { Deck } from "../models/deck.js";

//#region Deck service
export class DeckService {
	static #key: string = "Elements\\Deck";
	static #lock: boolean = true;
	static #instance: DeckService | null = null;
	#cell: BufferedCell<typeof Deck>;

	constructor() {
		if (DeckService.#lock) throw new TypeError("Illegal constructor");

		const key = DeckService.#key;
		try {
			this.#cell = localStorage.openBufferedCell(key, Deck, new Deck());
		} catch (reason) {
			if (!(reason instanceof SyntaxError) && !(reason instanceof TypeError)) throw reason;
			localStorage.removeItem(key);
			this.#cell = localStorage.openBufferedCell(key, Deck, new Deck());
		}
		this.#cell.content.reconcile();
	}

	static get instance(): DeckService {
		if (DeckService.#instance === null) {
			DeckService.#lock = false;
			DeckService.#instance = new DeckService();
			DeckService.#lock = true;
		}
		return DeckService.#instance;
	}

	get content(): Deck {
		return this.#cell.content;
	}

	async save(): Promise<void> {
		await this.#cell.save();
	}
}
//#endregion

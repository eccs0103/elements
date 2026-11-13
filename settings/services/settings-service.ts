"use strict";

import "adaptive-extender/web";
import { type BufferedCell } from "adaptive-extender/web";
import { Settings } from "../models/settings.js";

//#region Settings service
export class SettingsService {
	static #key: string = "Elements\\Settings";
	static #lock: boolean = true;
	static #instance: SettingsService | null = null;
	#cell: BufferedCell<typeof Settings>;

	constructor() {
		if (SettingsService.#lock) throw new TypeError("Illegal constructor");

		const key = SettingsService.#key;
		try {
			this.#cell = localStorage.openBufferedCell(key, Settings, new Settings());
		} catch (reason) {
			if (!(reason instanceof SyntaxError) && !(reason instanceof TypeError)) throw reason;
			localStorage.removeItem(key);
			this.#cell = localStorage.openBufferedCell(key, Settings, new Settings());
		}
	}

	static get instance(): SettingsService {
		if (SettingsService.#instance === null) {
			SettingsService.#lock = false;
			SettingsService.#instance = new SettingsService();
			SettingsService.#lock = true;
		}
		return SettingsService.#instance;
	}

	get content(): Settings {
		return this.#cell.content;
	}

	async save(): Promise<void> {
		await this.#cell.save();
	}

	reset(): void {
		this.#cell.reset();
	}
}
//#endregion

"use strict";

import "adaptive-extender/web";
import { Controller, URI } from "adaptive-extender/web";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SettingsService } from "../../settings/services/settings-service.js";
import { ArenaClient } from "../../arena/services/client.js";
import { Refusal, type History } from "../../arena/models/protocol.js";
import { UserApp } from "../view/user-app.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

const { baseURI, body } = document;
const settings = SettingsService.instance;

//#region User controller
class UserController extends Controller {
	static #period: number = 60000;
	static #tick: number = 30000;
	#client: ArenaClient = new ArenaClient(new URI("/", baseURI));
	#history: History | null = null;
	#trouble: string | null = null;

	async run(): Promise<void> {
		void AnalyticsController.launch();
		settings.apply();

		// Not simplified: a #root field would run before run(), so a missing div#root would skip the controller's catch (owner).
		const root = createRoot(body.getElement(HTMLDivElement, "div#root"));
		this.#render(root);
		await this.#refresh(root);
		setInterval(this.#refresh.bind(this, root), UserController.#period);
		setInterval(this.#render.bind(this, root), UserController.#tick);
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}

	async #refresh(root: Root): Promise<void> {
		try {
			this.#history = await this.#client.history();
			this.#trouble = null;
		} catch (reason) {
			this.#trouble = UserController.#describe(Error.from(reason));
		}
		this.#render(root);
	}

	static #describe(error: Error): string {
		if (error instanceof Refusal) return `The server refused: ${error.message}`;
		return `The server could not be reached: ${error.message}`;
	}

	#render(root: Root): void {
		root.render(<StrictMode><UserApp history={this.#history} trouble={this.#trouble} now={Date.now()} /></StrictMode>);
	}
}
//#endregion

await UserController.launch();

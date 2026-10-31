"use strict";

import "adaptive-extender/web";
import { Controller } from "adaptive-extender/web";
import { SettingsService } from "../../settings/services/settings-service.js";
import { AnalyticsController } from "../../environment/controllers/analytics-controller.js";

//#region Sandbox controller
class SandboxController extends Controller {
	async run(): Promise<void> {
		void AnalyticsController.launch();
		SettingsService.instance.content.apply();
	}

	async catch(error: Error): Promise<void> {
		window.alert(error.message);
	}
}
//#endregion

await SandboxController.launch();

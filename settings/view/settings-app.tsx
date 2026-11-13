"use strict";

import "adaptive-extender/web";
import { Enum } from "adaptive-extender/web";
import { type ReactElement, useReducer } from "react";
import { Scheme } from "../models/settings.js";
import { type SettingsService } from "../services/settings-service.js";

//#region Settings app
export interface SettingsAppProps {
	settings: SettingsService;
}

export function SettingsApp({ settings }: SettingsAppProps): ReactElement {
	const [, refresh] = useReducer((version: number) => version + 1, 0);
	const { content } = settings;

	const rescheme = async (value: string): Promise<void> => {
		content.scheme = Enum.Of(Scheme).import(value, "scheme");
		content.apply();
		refresh();
		try {
			await settings.save();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	};

	return (
		<main className="flex main-center">
			<div className="panel flex column with-gap with-padding large-padding">
				<div className="layer rounded flex column with-padding large-padding">
					<h3>General</h3>
					<section className="option">
						<p className="title">Color scheme</p>
						<select className="value depth rounded with-padding flex" required value={content.scheme} onChange={event => void rescheme(event.currentTarget.value)}>
							<option value={Scheme.system}>System</option>
							<option value={Scheme.light}>Light</option>
							<option value={Scheme.dark}>Dark</option>
						</select>
						<dfn className="definition">External design of the page: color scheme, background and foreground, font.</dfn>
					</section>
				</div>
			</div>
		</main>
	);
}
//#endregion

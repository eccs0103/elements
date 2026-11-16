"use strict";

import "adaptive-extender/web";
import { Enum } from "adaptive-extender/web";
import { type ReactElement, type RefObject, type SyntheticEvent, useReducer, useRef } from "react";
import { Scheme } from "../models/settings.js";
import { type SettingsService } from "../services/settings-service.js";

//#region Settings app
export interface SettingsAppProps {
	settings: SettingsService;
}

export function SettingsApp({ settings }: SettingsAppProps): ReactElement {
	const [, refresh] = useReducer((version: number) => version + 1, 0);
	const refDialog: RefObject<HTMLDialogElement | null> = useRef(null);
	const { content } = settings;

	const rescheme = async (value: string): Promise<void> => {
		content.scheme = Enum.Of(Scheme).import(value, "scheme");
		settings.apply();
		refresh();
		try {
			await settings.save();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
	};

	const ask = (): void => {
		const dialogReset = refDialog.current;
		if (dialogReset === null) return;
		// Escape keeps the previous returnValue, so a past "reset" would fire again without this.
		dialogReset.returnValue = String.empty;
		dialogReset.showModal();
	};

	const reset = (event: SyntheticEvent<HTMLDialogElement>): void => {
		if (event.currentTarget.returnValue !== "reset") return;
		settings.reset();
		settings.apply();
		refresh();
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
				<div className="layer rounded flex column with-padding large-padding">
					<h3>Advanced</h3>
					<section className="option">
						<p className="title">Reset settings</p>
						<button id="reset" type="button" className="value rounded depth alert with-padding flex alt-center with-gap" title="Reset settings" onClick={event => ask()}>
							<span className="icon in-line"></span>
							<span>Reset</span>
						</button>
						<dfn className="definition">Reverting all configurations to their default states.</dfn>
					</section>
				</div>
			</div>
			<dialog id="reset" ref={refDialog} className="pop-up layer rounded" aria-labelledby="reset-title" onClose={reset}>
				<div className="container flex column with-gap with-padding large-padding">
					<form method="dialog" className="contents">
						<h3 id="reset-title">Reset settings?</h3>
						<p className="description">Every setting goes back to its default.</p>
						<footer className="flex with-gap">
							<button type="submit" value="cancel" className="depth rounded with-padding" autoFocus>Cancel</button>
							<button type="submit" value="reset" className="depth rounded alert with-padding">Reset</button>
						</footer>
					</form>
				</div>
			</dialog>
		</main>
	);
}
//#endregion

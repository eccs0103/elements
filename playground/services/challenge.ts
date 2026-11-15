"use strict";

import "adaptive-extender/web";

//#region Challenge
interface TurnstileOptions {
	sitekey: string;
	action: string;
	appearance: string;
	callback(token: string): void;
	["error-callback"](code: string): void;
}

interface Turnstile {
	render(container: HTMLElement, options: TurnstileOptions): string;
	remove(widget: string): void;
}

declare global {
	interface Window {
		turnstile: Turnstile | undefined;
	}
}

export class Challenge {
	static #sitekey: string = "0x4AAAAAAGBet7ZYe7rBg5A8";
	static #action: string = "ticket";
	#container: HTMLElement;
	#script: HTMLScriptElement;

	constructor(container: HTMLElement, script: HTMLScriptElement) {
		this.#container = container;
		this.#script = script;
	}

	async token(): Promise<string> {
		const turnstile = await this.#load();
		const container = this.#container;
		return await new Promise<string>((resolve, reject) => {
			const widget = turnstile.render(container, {
				sitekey: Challenge.#sitekey,
				action: Challenge.#action,
				appearance: "interaction-only",
				callback(token: string): void {
					turnstile.remove(widget);
					resolve(token);
				},
				["error-callback"](code: string): void {
					reject(new Error(`The bot check failed (${code})`));
				},
			});
		});
	}

	async #load(): Promise<Turnstile> {
		const script = this.#script;
		// The script element's id must never be "turnstile": named access would make window.turnstile that element.
		if (window.turnstile === undefined) {
			await Promise.withSignal((signal, resolve, reject) => {
				script.addEventListener("load", event => resolve(), { signal });
				script.addEventListener("error", event => reject(new Error("The bot check could not load")), { signal });
			});
		}
		return ReferenceError.suppress(window.turnstile, "The bot check loaded without its API");
	}
}
//#endregion

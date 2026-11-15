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
		turnstile?: Turnstile;
	}
}

export class Challenge {
	static #sitekey: string = "1x00000000000000000000AA";
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
			await new Promise<void>((resolve, reject) => {
				script.addEventListener("load", event => resolve(), { once: true });
				script.addEventListener("error", event => reject(new Error("The bot check could not load")), { once: true });
			});
		}
		const { turnstile } = window;
		if (turnstile === undefined) throw new ReferenceError("The bot check loaded without its API");
		return turnstile;
	}
}
//#endregion

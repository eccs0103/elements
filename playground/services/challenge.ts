"use strict";

import "adaptive-extender/web";
import { Entry } from "../../arena/models/protocol.js";

//#region Challenge
interface TurnstileOptions {
	sitekey: string;
	action: string;
	appearance: string;
	retry: string;
	["retry-interval"]: number;
	callback(token: string): void;
	["error-callback"](code: string): boolean;
	["timeout-callback"](): void;
	["unsupported-callback"](): void;
	["before-interactive-callback"](): void;
	["after-interactive-callback"](): void;
}

interface Turnstile {
	render(container: HTMLElement, options: TurnstileOptions): string;
	remove(widget: string): void;
}

declare global {
	export interface Window {
		turnstile: Turnstile | undefined;
	}
}

export class Challenge {
	static #sitekey: string = "0x4AAAAAAGBet7ZYe7rBg5A8";
	static #patience: number = 15000;
	static #retries: number = 2;
	static #interval: number = 2000;
	// A Turnstile token expires after 300 s and works once; a younger one than this is safe to use.
	static #fresh: number = 240000;
	#dialog: HTMLDialogElement;
	#script: HTMLScriptElement;
	#early: Promise<string | null> | null = null;
	#born: number = 0;

	constructor(dialog: HTMLDialogElement, script: HTMLScriptElement) {
		this.#dialog = dialog;
		this.#script = script;
	}

	warm(): void {
		if (this.#early !== null) return;
		this.#early = this.#attempt();
	}

	async token(): Promise<string> {
		const early = this.#early;
		this.#early = null;
		if (early !== null) {
			const token = await early;
			if (token !== null && Date.now() - this.#born < Challenge.#fresh) return token;
		}
		return await this.#solve(false);
	}

	async #attempt(): Promise<string | null> {
		try {
			const token = await this.#solve(true);
			this.#born = Date.now();
			return token;
		} catch (reason) {
			console.error(`The early bot check did not finish:\n${Error.from(reason)}`);
			return null;
		}
	}

	async #solve(quiet: boolean): Promise<string> {
		const turnstile = await this.#load();
		const dialog = this.#dialog;
		return await new Promise<string>((resolve, reject) => {
			let failures = 0;
			const widget = turnstile.render(dialog, {
				sitekey: Challenge.#sitekey,
				action: Entry.action,
				appearance: "interaction-only",
				retry: "auto",
				["retry-interval"]: Challenge.#interval,
				callback(token: string): void {
					settle();
					resolve(token);
				},
				["error-callback"](code: string): boolean {
					if (++failures <= Challenge.#retries) return false;
					settle();
					reject(new Error(`The bot check failed (${code})`));
					return true;
				},
				["timeout-callback"](): void {
					settle();
					reject(new Error("The bot check timed out"));
				},
				["unsupported-callback"](): void {
					settle();
					reject(new Error("This browser is not supported by the bot check"));
				},
				["before-interactive-callback"](): void {
					if (quiet) {
						settle();
						reject(new Error("The early bot check needs interaction"));
						return;
					}
					if (!dialog.open) dialog.showModal();
				},
				["after-interactive-callback"](): void {
					dialog.close();
				},
			});
			function settle(): void {
				turnstile.remove(widget);
				dialog.close();
			}
		});
	}

	async #load(): Promise<Turnstile> {
		const script = this.#script;
		// The script element's id must never be "turnstile": named access would make window.turnstile that element.
		if (window.turnstile === undefined) {
			await Promise.withSignal((signal, resolve, reject) => {
				script.addEventListener("load", event => resolve(), { signal });
				script.addEventListener("error", event => reject(new Error("The bot check could not load")), { signal });
				// A load or error that fired before these listeners is never replayed.
				AbortSignal.timeout(Challenge.#patience).addEventListener("abort", event => reject(new Error("The bot check could not load")), { signal });
			});
		}
		return ReferenceError.suppress(window.turnstile, "The bot check loaded without its API");
	}
}
//#endregion

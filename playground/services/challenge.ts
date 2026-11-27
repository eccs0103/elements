"use strict";

import "adaptive-extender/web";
import { Entry } from "../../arena/models/protocol.js";

//#region Turnstile
interface TurnstileOptions {
	sitekey: string;
	action: string;
	appearance: string;
	retry: string;
	callback(token: string): void;
	["error-callback"](code: string): boolean;
	["timeout-callback"](): void;
	["unsupported-callback"](): void;
	["before-interactive-callback"](): void;
	["after-interactive-callback"](): void;
}

interface Turnstile {
	render(container: HTMLElement, options: TurnstileOptions): string;
	reset(widget: string): void;
	remove(widget: string): void;
}

declare global {
	export interface Window {
		turnstile: Turnstile | undefined;
	}
}
//#endregion
//#region Attempt
class Attempt {
	static #sitekey: string = "0x4AAAAAAGBet7ZYe7rBg5A8";
	static #retries: number = 1;
	static #interval: number = 2000;
	#turnstile: Turnstile;
	#dialog: HTMLDialogElement;
	#outcome: PromiseWithResolvers<string> = Promise.withResolvers();
	#widget: string | null = null;
	#failures: number = 0;
	#settled: boolean = false;

	constructor(turnstile: Turnstile, dialog: HTMLDialogElement) {
		this.#turnstile = turnstile;
		this.#dialog = dialog;
	}

	async run(container: HTMLElement, quiet: boolean): Promise<string> {
		this.#widget = this.#turnstile.render(container, {
			sitekey: Attempt.#sitekey,
			action: Entry.action,
			appearance: "interaction-only",
			// Retries are ours, not Turnstile's: its own retry timer outlives remove() and throws "Nothing to reset found".
			retry: "never",
			callback: this.#pass.bind(this),
			["error-callback"]: this.#error.bind(this),
			["timeout-callback"]: () => this.#fail(new Error("The bot check timed out")),
			["unsupported-callback"]: () => this.#fail(new Error("This browser is not supported by the bot check")),
			["before-interactive-callback"]: () => this.#interact(quiet),
			["after-interactive-callback"]: () => this.#dialog.close(),
		});
		return await this.#outcome.promise;
	}

	#pass(token: string): void {
		this.#settle();
		this.#outcome.resolve(token);
	}

	#fail(reason: Error): void {
		this.#settle();
		this.#outcome.reject(reason);
	}

	#error(code: string): boolean {
		const failures = ++this.#failures;
		if (failures <= Attempt.#retries) {
			setTimeout(this.#retry.bind(this), Attempt.#interval);
			return true;
		}
		this.#fail(new Error(`The bot check failed (${code})`));
		return true;
	}

	#retry(): void {
		if (this.#settled) return;
		this.#turnstile.reset(this.#target());
	}

	#interact(quiet: boolean): void {
		const dialog = this.#dialog;
		if (quiet) return this.#fail(new Error("The early bot check needs interaction"));
		if (dialog.open) return;
		dialog.showModal();
	}

	#settle(): void {
		this.#settled = true;
		this.#turnstile.remove(this.#target());
		this.#dialog.close();
	}

	#target(): string {
		return ReferenceError.suppress(this.#widget, "The bot check has no widget yet");
	}
}
//#endregion
//#region Challenge
export class Challenge {
	static #patience: number = 15000;
	// A Turnstile token expires after 300 s and works once; a younger one than this is safe to use.
	static #fresh: number = 240000;
	#host: HTMLElement;
	#dialog: HTMLDialogElement;
	#script: HTMLScriptElement;
	#early: Promise<string | null> | null = null;
	#born: number = 0;

	constructor(host: HTMLElement, dialog: HTMLDialogElement, script: HTMLScriptElement) {
		this.#host = host;
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
		const container = quiet ? this.#host : dialog;
		return await new Attempt(turnstile, dialog).run(container, quiet);
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

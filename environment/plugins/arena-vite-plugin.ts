"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { type PluginOption, type ViteDevServer, type PreviewServer, type Connect } from "vite";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { VitePlugin } from "./vite-plugin.js";

//#region Arena Vite plugin
export class ArenaVitePlugin extends VitePlugin {
	static #route: string = "/api";
	static #target: URI = new URI("http://localhost:8787/");
	// fetch has already decoded the body, so its length and encoding headers no longer describe what is sent.
	static #skipped: readonly string[] = ["set-cookie", "content-length", "content-encoding", "transfer-encoding"];

	constructor() {
		super("arena");
	}

	configureServer(server: ViteDevServer): void {
		this.#mount(server.middlewares);
	}

	configurePreviewServer(server: PreviewServer): void {
		this.#mount(server.middlewares);
	}

	build(): PluginOption {
		const configureServer = this.configureServer.bind(this);
		const configurePreviewServer = this.configurePreviewServer.bind(this);
		// The Cloudflare plugin answers every page path itself, so this middleware must be mounted before it.
		return { name: "arena", enforce: "pre", configureServer, configurePreviewServer };
	}

	#mount(middlewares: Connect.Server): void {
		middlewares.use(ArenaVitePlugin.#route, this.#forward.bind(this));
	}

	async #forward(request: Connect.IncomingMessage, response: ServerResponse, next: Connect.NextFunction): Promise<void> {
		try {
			const { method, headers, originalUrl } = request;
			if (originalUrl === undefined) throw new ReferenceError("The request has no address");
			const body = method === "GET" || method === "HEAD" ? null : await ArenaVitePlugin.#read(request);
			const forwarded = new Headers();
			for (const [name, value] of Object.entries(headers)) {
				if (typeof value === "string") forwarded.set(name, value);
			}
			const answer = await fetch(new URI(originalUrl, ArenaVitePlugin.#target).href, { method, headers: forwarded, body });
			response.statusCode = answer.status;
			for (const [name, value] of answer.headers) {
				if (ArenaVitePlugin.#skipped.includes(name)) continue;
				response.setHeader(name, value);
			}
			response.setHeader("set-cookie", answer.headers.getSetCookie());
			response.end(Buffer.from(await answer.arrayBuffer()));
		} catch (reason) {
			next(reason);
		}
	}

	static async #read(request: IncomingMessage): Promise<Buffer> {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		return Buffer.concat(chunks);
	}
}
//#endregion

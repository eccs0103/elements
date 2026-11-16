"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { type PluginOption, type ViteDevServer, type PreviewServer, type Connect, type HttpServer } from "vite";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { unstable_startWorker } from "wrangler";
import { VitePlugin } from "./vite-plugin.js";

//#region Arena Vite plugin
export class ArenaVitePlugin extends VitePlugin {
	static #route: string = "/api";
	static #config: URI = new URI("../../arena/wrangler.jsonc", new URI(import.meta.url));
	// fetch has already decoded the body, so its length and encoding headers no longer describe what is sent.
	static #skipped: readonly string[] = ["set-cookie", "content-length", "content-encoding", "transfer-encoding"];
	#worker: ReturnType<typeof unstable_startWorker> | null = null;

	constructor() {
		super("arena");
	}

	configureServer(server: ViteDevServer): void {
		this.#mount(server.middlewares, server.httpServer);
	}

	configurePreviewServer(server: PreviewServer): void {
		this.#mount(server.middlewares, server.httpServer);
	}

	build(): PluginOption {
		const configureServer = this.configureServer.bind(this);
		const configurePreviewServer = this.configurePreviewServer.bind(this);
		// The Cloudflare plugin answers every page path itself, so this middleware must be mounted before it.
		return { name: "arena", enforce: "pre", configureServer, configurePreviewServer };
	}

	#mount(middlewares: Connect.Server, http: HttpServer | null): void {
		middlewares.use(ArenaVitePlugin.#route, this.#forward.bind(this));
		http?.once("close", event => void this.#stop());
	}

	#start(host: string): ReturnType<typeof unstable_startWorker> {
		const running = this.#worker;
		if (running !== null) return running;
		// The origin makes the arena see the page's own address, so its catalog fetch reaches this server as it reaches the site in production.
		const worker = this.#worker = unstable_startWorker({ config: ArenaVitePlugin.#config.toPath(), dev: { inspector: false, server: { port: 0 }, origin: { hostname: host } } });
		return worker;
	}

	async #stop(): Promise<void> {
		const worker = this.#worker;
		if (worker === null) return;
		this.#worker = null;
		await (await worker).dispose();
	}

	async #forward(request: Connect.IncomingMessage, response: ServerResponse, next: Connect.NextFunction): Promise<void> {
		try {
			const { method, headers, originalUrl } = request;
			const address = ReferenceError.suppress(originalUrl, "The request has no address");
			const worker = await this.#start(ReferenceError.suppress(headers.host, "The request has no host"));
			const target = new URI((await worker.url).href);
			const body = method === "GET" || method === "HEAD" ? null : await ArenaVitePlugin.#read(request);
			const forwarded = new Headers();
			for (const [name, value] of Object.entries(headers)) {
				if (typeof value === "string") forwarded.set(name, value);
			}
			const answer = await fetch(new URI(address, target).href, { method, headers: forwarded, body });
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

"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { unstable_startWorker } from "wrangler";
import { Determinism } from "./determinism.js";

describe("Determinism", () => {
	it("hashes the same in Node and in workerd, equal to the pinned hash", async () => {
		const pinned = 3811082008;
		const local = Determinism.hash();
		const config = new URI("./wrangler.jsonc", new URI(import.meta.url)).toPath();
		const worker = await unstable_startWorker({ config, dev: { inspector: false, persist: false, server: { port: 0 } } });
		try {
			const response = await worker.fetch("http://localhost/");
			expect(Number(await response.text())).toBe(local);
			expect(local).toBe(pinned);
		} finally {
			await worker.dispose();
		}
	}, 60000);
});

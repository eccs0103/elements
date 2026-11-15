"use strict";

import "adaptive-extender/node";
import { URI } from "adaptive-extender/node";
import { defineConfig } from "vite";
import { type ViteConfig } from "../environment/configs/vite-config.js";
import { NodeConfig } from "../environment/configs/node-config.js";
import { type VitePlugin } from "../environment/plugins/vite-plugin.js";

export default defineConfig(async (env) => {
	const root: URI = new URI(import.meta.url);
	const inputs: URI[] = [
		new URI("./controllers/verify.ts", root),
	];
	const source: URI = new URI("./controllers/", root);
	const output: URI = new URI("../dist/verifier", root);
	const externals: string[] = ["adaptive-extender"];
	const plugins: VitePlugin[] = [];
	const config: ViteConfig = await NodeConfig.construct(inputs, source, output, externals, plugins);
	return config.build();
});

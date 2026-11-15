"use strict";

// No adaptive-extender here: the bundle carries its own copy, and a second one throws "Cannot redefine property".
import URLUtilities from "node:url";
import ChildProcess from "node:child_process";
import Test from "node:test";
import Assert from "node:assert/strict";
import { unstable_startWorker } from "wrangler";

Test.test("the engine hash is the same in Node and in workerd, and equals the pinned one", async (context) => {
	void context;
	const pinned = 3811082008;
	const here = import.meta.url;
	const config = URLUtilities.fileURLToPath(new URL("./wrangler.jsonc", here));
	const output = new URL("../dist/tests/", here);
	const wrangler = URLUtilities.fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", here));
	// A relative --outdir with --config lands the bundle next to the config, not in the working directory.
	ChildProcess.execFileSync(process.execPath, [wrangler, "deploy", "--dry-run", "--config", config, "--outdir", URLUtilities.fileURLToPath(output)], { stdio: "ignore" });
	const bundle = await import(new URL("./hash-worker.js", output).href);
	const local = bundle.Determinism.hash();
	const worker = await unstable_startWorker({ config, dev: { inspector: false, persist: false, server: { port: 0 } } });
	try {
		const response = await worker.fetch("http://localhost/");
		const remote = Number(await response.text());
		Assert.equal(remote, local);
		Assert.equal(local, pinned);
	} finally {
		await worker.dispose();
	}
});

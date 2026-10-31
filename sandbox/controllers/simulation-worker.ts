"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Command, InitializeCommand, GenerateCommand, TickCommand, CaptureCommand, PictureCommand, StallCommand } from "../models/commands.js";
import { Board } from "../services/board.js";
import { Painter } from "../services/painter.js";

//#region Simulation worker
class SimulationWorker extends Controller {
	#board: Board;
	#painter: Painter;
	#stalled: boolean = false;

	#generate(size: number, seed: number): void {
		const board = this.#board = new Board(size, seed);
		board.generate();
		this.#stalled = false;
		this.#painter.paint(board);
	}

	#tick(): void {
		const board = this.#board;
		if (board.step()) return this.#painter.paint(board);
		if (this.#stalled) return;
		this.#stalled = true;
		self.postMessage(Command.export(new StallCommand()));
	}

	async #capture(width: number, height: number): Promise<void> {
		const picture = await this.#painter.capture(width, height);
		self.postMessage(Command.export(new PictureCommand(picture)));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeCommand) {
			const { canvas, size, seed } = command;
			canvas.width = size;
			canvas.height = size;
			this.#painter = new Painter(canvas);
			this.#generate(size, seed);
			return;
		}

		if (command instanceof GenerateCommand) {
			this.#generate(this.#board.size, command.seed);
			return;
		}

		if (command instanceof TickCommand) {
			this.#tick();
			return;
		}

		if (command instanceof CaptureCommand) {
			const { width, height } = command;
			void this.#capture(width, height);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await SimulationWorker.launch();

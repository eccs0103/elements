"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Command, InitializeCommand, GenerateCommand, TickCommand, DropCommand } from "../models/commands.js";
import { Board } from "../services/board.js";
import { Painter } from "../services/painter.js";

//#region Simulation worker
class SimulationWorker extends Controller {
	#board: Board;
	#painter: Painter;
	#size: number;

	#generate(seed: number): void {
		const board = this.#board = new Board(this.#size, seed);
		board.generate();
		this.#painter.paint(board);
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeCommand) {
			const { canvas, size, seed } = command;
			canvas.width = size;
			canvas.height = size;
			this.#size = size;
			this.#painter = new Painter(canvas);
			this.#generate(seed);
			return;
		}

		if (command instanceof GenerateCommand) {
			this.#generate(command.seed);
			return;
		}

		const board = this.#board;
		const painter = this.#painter;

		if (command instanceof TickCommand) {
			board.step();
			painter.paint(board);
			return;
		}

		if (command instanceof DropCommand) {
			const { kind, x, y } = command;
			board.drop(kind, x, y);
			painter.paint(board);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await SimulationWorker.launch();

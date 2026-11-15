"use strict";

import "adaptive-extender/worker";
import { Controller, Nullable } from "adaptive-extender/worker";
import { Command, InitializeCommand, StartCommand, TickCommand, DropCommand, PreviewCommand, InspectCommand, ResizeCommand, StatusCommand, FinishCommand } from "../models/commands.js";
import { PeriodicTable } from "../services/periodic-table.js";
import { Move } from "../models/move.js";
import { Match } from "../services/match.js";
import { Human, type Player } from "../services/players.js";
import { Painter } from "../services/painter.js";
import { Report, Verdict, type Ticket } from "../../arena/models/protocol.js";

//#region Stage
interface Stage {
	paint(painter: Painter, preview: boolean): void;
	status(cell: number | null): StatusCommand;
	play(slot: number, x: number, y: number): boolean;
	advance(): boolean;
	finish(): FinishCommand | null;
}
//#endregion
//#region Session
class Session implements Stage {
	#ticket: Ticket;
	#match: Match;
	#players: readonly Player[];
	#zone: Uint8Array;

	constructor(ticket: Ticket) {
		const match = this.#match = ticket.match();
		const { size } = match.rules;
		this.#ticket = ticket;
		this.#players = ticket.lineup(new Human());
		this.#zone = new Uint8Array(size * size);
	}

	paint(painter: Painter, preview: boolean): void {
		painter.paint(this.#match.board, preview ? this.#mark() : null);
	}

	status(cell: number | null): StatusCommand {
		const match = this.#match;
		const { human } = this.#ticket;
		const { kinds } = match.board;
		const inspected = Nullable.map(cell, cell => PeriodicTable.at(kinds[cell]));
		const holder = Nullable.map(cell, match.holder.bind(match));
		return new StatusCommand(Array.from(match.cards(human)), match.charge(human), inspected, holder, match.tick, Verdict.of(match));
	}

	play(slot: number, x: number, y: number): boolean {
		const match = this.#match;
		return match.play(new Move(match.tick, this.#ticket.human, slot, x, y));
	}

	advance(): boolean {
		const match = this.#match;
		if (match.finished) return false;
		match.advance(this.#players);
		return true;
	}

	finish(): FinishCommand | null {
		const match = this.#match;
		if (!match.finished) return null;
		const { id, human } = this.#ticket;
		return new FinishCommand(new Report(id, match.moves.filter(move => move.side === human)), Verdict.of(match));
	}

	#mark(): Uint8Array {
		const zone = this.#zone;
		zone.fill(0);
		for (const cell of this.#match.cells(this.#ticket.human, 0)) {
			zone[cell] = 1;
		}
		return zone;
	}
}
//#endregion
//#region Lobby
class Lobby implements Stage {
	#ticket: Ticket;

	constructor(ticket: Ticket) {
		this.#ticket = ticket;
	}

	paint(painter: Painter, preview: boolean): void {
		void preview;
		painter.ground(this.#ticket.rules.size);
	}

	status(cell: number | null): StatusCommand {
		const inspected = Nullable.map(cell, cell => PeriodicTable.ground);
		const tally = new Verdict(new Array<number>(Match.count).fill(0));
		return new StatusCommand(Array.from(this.#ticket.opening()), 1, inspected, null, 0, tally);
	}

	play(slot: number, x: number, y: number): boolean {
		void slot, x, y;
		return false;
	}

	advance(): boolean {
		return false;
	}

	finish(): FinishCommand | null {
		return null;
	}
}
//#endregion
//#region Simulation worker
class SimulationWorker extends Controller {
	#painter: Painter;
	#stage: Stage | null = null;
	#preview: boolean = false;
	#inspected: number | null = null;

	#refresh(): void {
		const stage = this.#stage;
		if (stage === null) return;
		stage.paint(this.#painter, this.#preview);
		this.#describe();
	}

	#describe(): void {
		const stage = this.#stage;
		if (stage === null) return;
		self.postMessage(Command.export(stage.status(this.#inspected)));
	}

	#tick(): void {
		const stage = this.#stage;
		if (stage === null || !stage.advance()) return;
		this.#refresh();
		const finish = stage.finish();
		if (finish !== null) self.postMessage(Command.export(finish));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeCommand) {
			this.#painter = new Painter(command.canvas);
			return;
		}

		if (command instanceof StartCommand) {
			const { ticket } = command;
			this.#stage = ticket.started ? new Session(ticket) : new Lobby(ticket);
			this.#refresh();
			return;
		}

		if (command instanceof PreviewCommand) {
			this.#preview = command.active;
			this.#refresh();
			return;
		}

		if (command instanceof InspectCommand) {
			this.#inspected = command.cell;
			this.#describe();
			return;
		}

		if (command instanceof ResizeCommand) {
			const { width, height } = command;
			this.#painter.resize(width, height);
			this.#refresh();
			return;
		}

		if (command instanceof TickCommand) {
			this.#tick();
			return;
		}

		if (command instanceof DropCommand) {
			const stage = this.#stage;
			const { slot, x, y } = command;
			if (stage !== null && stage.play(slot, x, y)) this.#refresh();
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await SimulationWorker.launch();

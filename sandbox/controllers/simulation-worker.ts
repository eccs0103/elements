"use strict";

import "adaptive-extender/worker";
import { Controller } from "adaptive-extender/worker";
import { Command, InitializeCommand, StartCommand, TickCommand, DropCommand, PreviewCommand, ResizeCommand, StatusCommand, FinishCommand } from "../models/commands.js";
import { Move } from "../models/move.js";
import { type Match } from "../services/match.js";
import { Human, type Player } from "../services/players.js";
import { Painter } from "../services/painter.js";
import { Report, type Ticket } from "../../arena/models/protocol.js";

//#region Session
class Session {
	#ticket: Ticket;
	#match: Match;
	#players: readonly Player[];
	#zone: Uint8Array;

	constructor(ticket: Ticket) {
		const match = this.#match = ticket.match();
		const { size } = match.rules;
		this.#ticket = ticket;
		this.#players = ticket.lineup(match, new Human());
		this.#zone = new Uint8Array(size * size);
	}

	get match(): Match { return this.#match; }

	advance(): void {
		this.#match.advance(this.#players);
	}

	play(slot: number, x: number, y: number): boolean {
		const match = this.#match;
		return match.play(new Move(match.tick, this.#ticket.human, slot, x, y));
	}

	zone(): Uint8Array {
		const match = this.#match;
		const zone = this.#zone;
		const { human } = this.#ticket;
		const { size } = match.rules;
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				zone[y * size + x] = Number(match.legal(human, 0, x, y));
			}
		}
		return zone;
	}

	status(): StatusCommand {
		const match = this.#match;
		const { human } = this.#ticket;
		return new StatusCommand(Array.from(match.cards(human)), match.charge(human));
	}

	report(): Report {
		const { id, human } = this.#ticket;
		return new Report(id, this.#match.moves.filter(move => move.side === human));
	}
}
//#endregion
//#region Simulation worker
class SimulationWorker extends Controller {
	#painter: Painter;
	#session: Session | null = null;
	#preview: boolean = false;

	#paint(session: Session): void {
		this.#painter.paint(session.match.board, this.#preview ? session.zone() : null);
		self.postMessage(Command.export(session.status()));
	}

	#tick(session: Session): void {
		const { match } = session;
		if (match.finished) return;
		session.advance();
		this.#paint(session);
		if (!match.finished) return;
		self.postMessage(Command.export(new FinishCommand(session.report())));
	}

	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeCommand) {
			this.#painter = new Painter(command.canvas);
			return;
		}

		if (command instanceof StartCommand) {
			const session = this.#session = new Session(command.ticket);
			this.#paint(session);
			return;
		}

		const session = this.#session;

		if (command instanceof PreviewCommand) {
			this.#preview = command.active;
			if (session !== null) this.#paint(session);
			return;
		}

		if (command instanceof ResizeCommand) {
			const { width, height } = command;
			this.#painter.resize(width, height);
			if (session !== null) this.#paint(session);
			return;
		}

		if (session === null) return;

		if (command instanceof TickCommand) {
			this.#tick(session);
			return;
		}

		if (command instanceof DropCommand) {
			const { slot, x, y } = command;
			if (session.play(slot, x, y)) this.#paint(session);
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await SimulationWorker.launch();

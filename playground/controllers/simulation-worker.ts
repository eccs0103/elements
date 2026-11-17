"use strict";

import "adaptive-extender/worker";
import { Controller, Nullable, URI } from "adaptive-extender/worker";
import { Command, InitializeCommand, StartCommand, BeginCommand, TickCommand, DropCommand, PreviewCommand, InspectCommand, ResizeCommand, StatusCommand, FinishCommand } from "../models/commands.js";
import { PeriodicTable } from "../services/periodic-table.js";
import { Move } from "../models/move.js";
import { Match } from "../services/match.js";
import { Human, type Player } from "../services/players.js";
import { Painter } from "../services/painter.js";
import { type Agent, type Mind } from "../services/agent.js";
import { AgentCommand, LoadCommand, DecideCommand, DecisionCommand } from "../models/agent-commands.js";
import { type Observation } from "../models/observation.js";
import { Rules } from "../models/rules.js";
import { Report, Verdict, type Ticket } from "../../arena/models/protocol.js";

//#region Stage
interface Stage {
	paint(painter: Painter, zone: Uint8Array | null): void;
	zone(): Uint8Array | null;
	status(cell: number | null): StatusCommand;
	play(slot: number, x: number, y: number): boolean;
	advance(): boolean;
	finish(): FinishCommand | null;
	keep(next: Stage): Stage;
	begin(): Stage;
}
//#endregion
//#region Session
class Session implements Stage {
	#ticket: Ticket;
	#match: Match;
	#rival: Agent;
	#players: readonly Player[];
	#zone: Uint8Array;

	constructor(ticket: Ticket, rival: Agent) {
		const match = this.#match = ticket.match();
		const { size } = match.rules;
		this.#ticket = ticket;
		this.#rival = rival;
		this.#players = ticket.lineup(new Human(), rival);
		this.#zone = new Uint8Array(size * size);
	}

	paint(painter: Painter, zone: Uint8Array | null): void {
		painter.paint(this.#match.board, zone);
	}

	zone(): Uint8Array {
		const zone = this.#zone;
		zone.fill(0);
		// Not simplified: Observation.of builds the same mask from match.cells, but mirrored for the side, so one owner saves nothing.
		for (const cell of this.#match.cells(this.#ticket.human, 0)) {
			zone[cell] = 1;
		}
		return zone;
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
		if (match.finished || this.#rival.waits(match)) return false;
		match.advance(this.#players);
		return true;
	}

	finish(): FinishCommand | null {
		const match = this.#match;
		if (!match.finished) return null;
		const { id, human } = this.#ticket;
		const verdict = Verdict.of(match);
		return new FinishCommand(new Report(id, match.moves.filter(move => move.side === human), verdict.winner(human) === human), verdict);
	}

	keep(next: Stage): Stage {
		if (!this.#match.finished) return next;
		return new Aftermath(this, next);
	}

	begin(): Stage {
		return this;
	}
}
//#endregion
//#region Waiting
class Waiting implements Stage {
	paint(painter: Painter, zone: Uint8Array | null): void {
		void zone;
		painter.ground(new Rules().size);
	}

	zone(): Uint8Array | null {
		return null;
	}

	status(cell: number | null): StatusCommand {
		void cell;
		// Not simplified: Simulation builds the same empty Verdict, but a factory would add a method and save nothing at the two call sites.
		return new StatusCommand([], 1, null, null, 0, new Verdict(new Array<number>(Match.count).fill(0)));
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

	keep(next: Stage): Stage {
		return next;
	}

	begin(): Stage {
		return this;
	}
}
//#endregion
//#region Aftermath
class Aftermath extends Waiting {
	#past: Stage;
	#next: Stage;

	constructor(past: Stage, next: Stage) {
		super();
		this.#past = past;
		this.#next = next;
	}

	paint(painter: Painter, zone: Uint8Array | null): void {
		this.#past.paint(painter, zone);
	}

	zone(): Uint8Array | null {
		return this.#next.zone();
	}

	status(cell: number | null): StatusCommand {
		const { inspected, holder, tick, tally } = this.#past.status(cell);
		const { cards, charge } = this.#next.status(null);
		return new StatusCommand(cards, charge, inspected, holder, tick, tally);
	}

	keep(next: Stage): Stage {
		return new Aftermath(this.#past, next);
	}

	begin(): Stage {
		return this.#next;
	}
}
//#endregion
//#region Worker mind
class WorkerMind implements Mind {
	#worker: Worker;
	#number: number = 0;
	#agent: Agent | null = null;

	constructor(worker: Worker) {
		this.#worker = worker;
		worker.addEventListener("message", this.#onMessage.bind(this));
	}

	ask(question: Observation, agent: Agent): void {
		const number = this.#number + 1;
		this.#number = number;
		this.#agent = agent;
		this.#worker.postMessage(AgentCommand.export(new DecideCommand(number, question)));
	}

	#onMessage(event: MessageEvent): void {
		const command = AgentCommand.import(event.data, "command");
		if (!(command instanceof DecisionCommand) || command.number !== this.#number) return;
		this.#agent?.answer(command.action);
	}
}
//#endregion
//#region Simulation worker
class SimulationWorker extends Controller {
	#agent: Worker = new Worker(new URI("./agent-worker.js", new URI(self.location.href)).href, { type: "module" });
	#mind: WorkerMind = new WorkerMind(this.#agent);
	#catalog: URI;
	#painter: Painter;
	#stage: Stage = new Waiting();
	#preview: boolean = false;
	#inspected: number | null = null;

	#refresh(): void {
		const stage = this.#stage;
		stage.paint(this.#painter, this.#preview ? stage.zone() : null);
		this.#describe();
	}

	#describe(): void {
		self.postMessage(Command.export(this.#stage.status(this.#inspected)));
	}

	#tick(): void {
		const stage = this.#stage;
		if (!stage.advance()) return;
		this.#refresh();
		const finish = stage.finish();
		if (finish !== null) self.postMessage(Command.export(finish));
	}

	// Not simplified: the last branch keeps its return, so every branch has one shape (owner ruling).
	#onMessage(event: MessageEvent): void {
		const command = Command.import(event.data, "command");

		if (command instanceof InitializeCommand) {
			const { canvas, catalog } = command;
			this.#painter = new Painter(canvas);
			this.#catalog = catalog;
			return;
		}

		if (command instanceof StartCommand) {
			const { ticket } = command;
			this.#agent.postMessage(AgentCommand.export(new LoadCommand(ticket.model.weights(this.#catalog))));
			this.#stage = this.#stage.keep(new Session(ticket, ticket.agent(this.#mind)));
			this.#refresh();
			return;
		}

		if (command instanceof PreviewCommand) {
			this.#preview = command.active;
			this.#refresh();
			return;
		}

		if (command instanceof BeginCommand) {
			this.#stage = this.#stage.begin();
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
			if (stage.play(slot, x, y)) this.#refresh();
			return;
		}
	}

	async run(): Promise<void> {
		self.addEventListener("message", this.#onMessage.bind(this));
	}
}
//#endregion

await SimulationWorker.launch();

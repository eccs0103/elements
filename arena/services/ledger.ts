"use strict";

import "adaptive-extender/worker";
import { type Store, type PortableStore } from "adaptive-extender/worker";
import { Ticket, Standing } from "../models/protocol.js";
import { type Ledger } from "./arena.js";

//#region Indexed ledger
export class IndexedLedger implements Ledger {
	static #standing: string = "global";
	#tickets: PortableStore<typeof Ticket, "id"> = indexedDB.openPortableStore("Elements", "Tickets", Ticket, "id");
	#standings: Store<string> = indexedDB.openStore<string>("Elements", "Standings");

	async save(ticket: Ticket): Promise<void> {
		await this.#tickets.insert(ticket);
	}

	async take(id: string): Promise<Ticket | null> {
		const tickets = this.#tickets;
		const ticket = await tickets.select(id);
		if (ticket === null) return null;
		await tickets.delete(id);
		return ticket;
	}

	async standing(): Promise<Standing> {
		const value = await this.#standings.select(IndexedLedger.#standing);
		if (value === null) return new Standing();
		return Standing.import(value, "standing");
	}

	async record(standing: Standing): Promise<void> {
		await this.#standings.upsert(IndexedLedger.#standing, Standing.export(standing));
	}
}
//#endregion

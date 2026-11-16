"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { Simulation } from "../services/simulation.js";
import { type Ticket } from "../../arena/models/protocol.js";
import { Crosshair } from "./crosshair.js";
import { type Notice } from "./notice.js";
import { Peek } from "./peek.js";
import { Scoreboard } from "./scoreboard.js";
import { Tray } from "./tray.js";

//#region Board notice
interface BoardNoticeProps {
	notice: Notice;
}

function BoardNotice({ notice }: BoardNoticeProps): ReactElement {
	const [now, setNow] = useState<number>(Date.now);
	const { deadline, target, note, action } = notice;

	useEffect(() => {
		setNow(Date.now());
		if (deadline === null) return;
		const interval = setInterval(() => {
			const current = Date.now();
			setNow(current);
			if (current >= deadline) clearInterval(interval);
		}, 1000);
		return () => clearInterval(interval);
	}, [deadline]);

	const locked = notice.locked(now);
	const line = notice.line(now);

	return (
		<section id="notice" className="layer rounded flex column with-gap with-padding large-padding" hidden={notice.hidden} aria-busy={notice.busy} aria-live="polite">
			<h2>{notice.title}</h2>
			<p className="description">{notice.description}</p>
			<p className="note" hidden={note === null}>{note}</p>
			<p className="highlight" hidden={line === null}>{line}</p>
			<a className="depth rounded with-padding" role="button" href={target?.href} hidden={action === null || target === null} aria-disabled={locked} tabIndex={locked ? -1 : 0}>{action}</a>
		</section>
	);
}
//#endregion
//#region Playground app
export interface PlaygroundAppProps {
	ticket: Ticket | null;
	notice: Notice;
	onLaunch(simulation: Simulation): void;
	onFinish(simulation: Simulation): void;
}

export function PlaygroundApp({ ticket, notice, onLaunch, onFinish }: PlaygroundAppProps): ReactElement {
	const [simulation, setSimulation] = useState<Simulation | null>(null);
	const [crosshair, setCrosshair] = useState<Crosshair | null>(null);
	const refBoard: RefObject<HTMLCanvasElement | null> = useRef(null);
	const refCrosshair: RefObject<HTMLDivElement | null> = useRef(null);
	const refSimulation: RefObject<Simulation | null> = useRef(null);

	useEffect(() => {
		const canvasBoard = refBoard.current;
		const divCrosshair = refCrosshair.current;
		if (canvasBoard === null || divCrosshair === null) return;
		if (refSimulation.current !== null) return;
		const created = refSimulation.current = new Simulation(canvasBoard);
		created.addEventListener("launch", event => onLaunch(created));
		created.addEventListener("finish", event => onFinish(created));
		setSimulation(created);
		setCrosshair(new Crosshair(divCrosshair, canvasBoard, created));
	}, [onLaunch, onFinish]);

	useEffect(() => {
		if (simulation === null || ticket === null) return;
		simulation.start(ticket);
	}, [simulation, ticket]);

	return (
		<main>
			<div id="stage">
				{simulation === null || ticket === null ? null : <Scoreboard simulation={simulation} ticket={ticket} />}
				<canvas id="board" ref={refBoard} onContextMenu={event => event.preventDefault()}></canvas>
				<div id="crosshair" ref={refCrosshair} hidden>
					<span className="row"></span>
					<span className="column"></span>
					<span className="cell"></span>
				</div>
				<BoardNotice notice={notice} />
				{simulation === null || crosshair === null || ticket === null ? null : <Peek board={refBoard} crosshair={crosshair} simulation={simulation} ticket={ticket} />}
				<div id="toolkit" className="flex">
					{simulation === null || crosshair === null ? null : <Tray simulation={simulation} crosshair={crosshair} />}
				</div>
			</div>
		</main>
	);
}
//#endregion

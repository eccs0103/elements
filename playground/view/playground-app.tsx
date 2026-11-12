"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { Simulation } from "../services/simulation.js";
import { type Ticket } from "../../arena/models/protocol.js";
import { Crosshair } from "./crosshair.js";
import { Peek } from "./peek.js";
import { Tray } from "./tray.js";

//#region Playground app
export interface PlaygroundAppProps {
	ticket: Ticket;
	onFinish(simulation: Simulation): void;
}

export function PlaygroundApp({ ticket, onFinish }: PlaygroundAppProps): ReactElement {
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
		created.addEventListener("finish", event => onFinish(created));
		created.start(ticket);
		setSimulation(created);
		setCrosshair(new Crosshair(divCrosshair, canvasBoard, created));
	}, [ticket, onFinish]);

	return (
		<main>
			<div id="stage">
				<canvas id="board" ref={refBoard} onContextMenu={event => event.preventDefault()}></canvas>
				<div id="crosshair" ref={refCrosshair} hidden>
					<span className="row"></span>
					<span className="column"></span>
					<span className="cell"></span>
				</div>
				{simulation === null || crosshair === null ? null : <Peek board={refBoard} crosshair={crosshair} simulation={simulation} ticket={ticket} />}
				<div id="toolkit" className="flex">
					{simulation === null || crosshair === null ? null : <Tray simulation={simulation} crosshair={crosshair} />}
				</div>
			</div>
		</main>
	);
}
//#endregion

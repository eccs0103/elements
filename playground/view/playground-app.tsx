"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { Simulation } from "../services/simulation.js";
import { type Standing, type Ticket } from "../../arena/models/protocol.js";
import { Crosshair } from "./crosshair.js";
import { Peek } from "./peek.js";
import { Scoreboard } from "./scoreboard.js";
import { Tray } from "./tray.js";

//#region Intro
interface IntroProps {
	simulation: Simulation | null;
	standing: Standing;
	ticket: Ticket;
}

function Intro({ simulation, standing, ticket }: IntroProps): ReactElement {
	const [launched, setLaunched] = useState<boolean>(false);
	const { humanity, agent } = standing;
	const { model, rules } = ticket;

	useEffect(() => {
		if (simulation === null) return;
		const update = (event: Event): void => setLaunched(simulation.launched);
		simulation.addEventListener("update", update);
		return () => simulation.removeEventListener("update", update);
	}, [simulation]);

	return (
		<section id="intro" className="layer rounded flex column with-gap with-padding large-padding" hidden={launched}>
			<h2>{`Humanity ${humanity} : ${agent} ${model}`}</h2>
			<p className="description">{`Drop elements to spread over the board: more cells after ${rules.seconds} s wins.`}</p>
			<p className="highlight">Drag a card to start the game</p>
		</section>
	);
}
//#endregion
//#region Playground app
export interface PlaygroundAppProps {
	ticket: Ticket;
	standing: Standing;
	onLaunch(simulation: Simulation): void;
	onFinish(simulation: Simulation): void;
}

export function PlaygroundApp({ ticket, standing, onLaunch, onFinish }: PlaygroundAppProps): ReactElement {
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
		created.start(ticket);
		setSimulation(created);
		setCrosshair(new Crosshair(divCrosshair, canvasBoard, created));
	}, [ticket, onLaunch, onFinish]);

	return (
		<main>
			<div id="stage">
				{simulation === null ? null : <Scoreboard simulation={simulation} ticket={ticket} />}
				<canvas id="board" ref={refBoard} onContextMenu={event => event.preventDefault()}></canvas>
				<div id="crosshair" ref={refCrosshair} hidden>
					<span className="row"></span>
					<span className="column"></span>
					<span className="cell"></span>
				</div>
				<Intro simulation={simulation} standing={standing} ticket={ticket} />
				{simulation === null || crosshair === null ? null : <Peek board={refBoard} crosshair={crosshair} simulation={simulation} ticket={ticket} />}
				<div id="toolkit" className="flex">
					{simulation === null || crosshair === null ? null : <Tray simulation={simulation} crosshair={crosshair} />}
				</div>
			</div>
		</main>
	);
}
//#endregion

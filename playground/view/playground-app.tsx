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
	standing: Standing | null;
	ticket: Ticket | null;
}

function Intro({ simulation, standing, ticket }: IntroProps): ReactElement {
	const [launched, setLaunched] = useState<boolean>(false);
	const ready = standing !== null && ticket !== null;
	let title = "Your rival is getting ready";
	let description = "Loading the match takes a few seconds";
	let hint = "Loading the match…";
	if (ready) {
		const { humanity, agent } = standing;
		const { model, rules } = ticket;
		title = `Humanity ${humanity} : ${agent} ${model}`;
		description = `Drop elements to spread over the board: more cells after ${rules.seconds} s wins.`;
		hint = "Drag a card to start the game";
	}

	useEffect(() => {
		if (simulation === null) return;
		const update = (event: Event): void => setLaunched(simulation.launched);
		simulation.addEventListener("update", update);
		return () => simulation.removeEventListener("update", update);
	}, [simulation]);

	return (
		<section id="intro" className="layer rounded flex column with-gap with-padding large-padding" hidden={launched} aria-busy={!ready}>
			<h2>{title}</h2>
			<p className="description">{description}</p>
			<p className="highlight">{hint}</p>
		</section>
	);
}
//#endregion
//#region Playground app
export interface PlaygroundAppProps {
	ticket: Ticket | null;
	standing: Standing | null;
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
				<Intro simulation={simulation} standing={standing} ticket={ticket} />
				{simulation === null || crosshair === null || ticket === null ? null : <Peek board={refBoard} crosshair={crosshair} simulation={simulation} ticket={ticket} />}
				<div id="toolkit" className="flex">
					{simulation === null || crosshair === null ? null : <Tray simulation={simulation} crosshair={crosshair} />}
				</div>
			</div>
		</main>
	);
}
//#endregion

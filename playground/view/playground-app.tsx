"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { Simulation } from "../services/simulation.js";
import { type Ticket } from "../../arena/models/protocol.js";
import { Mode } from "../../settings/models/settings.js";
import { Crosshair } from "./crosshair.js";
import { type Notice } from "./notice.js";
import { Peek } from "./peek.js";
import { Scoreboard } from "./scoreboard.js";
import { Tray } from "./tray.js";

//#region Mode switch
interface ModeSwitchProps {
	mode: Mode;
	online: boolean | null;
	hidden: boolean;
	onSwitch(mode: Mode): void;
}

function ModeSwitch({ mode, online, hidden, onSwitch }: ModeSwitchProps): ReactElement {
	let state = "Counts for Humanity";
	if (online === null) state = "Connecting…";
	if (online === false) state = "Offline";

	return (
		<fieldset id="mode" className="depth rounded" hidden={hidden}>
			<legend>Mode</legend>
			<span className="pill rounded"></span>
			<input id="arena" type="radio" name="mode" checked={mode === Mode.arena} disabled={online !== true} onChange={event => onSwitch(Mode.arena)} />
			<label htmlFor="arena" className="rounded with-padding small-padding">
				<span className="name">Arena</span>
				<span className="state font-smaller-3">{state}</span>
			</label>
			<input id="practice" type="radio" name="mode" checked={mode === Mode.practice} onChange={event => onSwitch(Mode.practice)} />
			<label htmlFor="practice" className="rounded with-padding small-padding">
				<span className="name">Practice</span>
				<span className="state font-smaller-3">Not counted</span>
			</label>
		</fieldset>
	);
}
//#endregion
//#region Notice side
interface NoticeSideProps {
	notice: Notice;
	shown: boolean;
	onAgain(): void;
}

function NoticeSide({ notice, shown, onAgain }: NoticeSideProps): ReactElement {
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

	return (
		<article className="flex column with-gap" inert={!shown} aria-hidden={!shown} aria-busy={notice.busy}>
			<h2>{notice.title}</h2>
			<p className="description">{notice.description}</p>
			<p className="note" aria-hidden={note === null}>{note}</p>
			<footer>
				<p className="highlight" hidden={action !== null}>{notice.hint}</p>
				<a className="depth rounded with-padding" role="button" href={target?.href} hidden={target === null}>{action}</a>
				<button type="button" className="depth rounded with-padding" hidden={action === null || target !== null} disabled={locked} onClick={event => onAgain()}>{notice.caption(now)}</button>
			</footer>
		</article>
	);
}
//#endregion
//#region Board notice
interface BoardNoticeProps {
	mode: Mode;
	online: boolean | null;
	arena: Notice;
	practice: Notice;
	playing: boolean;
	switchable: boolean;
	onSwitch(mode: Mode): void;
	onAgain(): void;
}

function BoardNotice({ mode, online, arena, practice, playing, switchable, onSwitch, onAgain }: BoardNoticeProps): ReactElement {
	return (
		<section id="notice" className="layer rounded flex column with-gap with-padding large-padding" hidden={playing} aria-live="polite">
			<ModeSwitch mode={mode} online={online} hidden={!switchable} onSwitch={onSwitch} />
			<div id="sides">
				<NoticeSide notice={arena} shown={mode === Mode.arena} onAgain={onAgain} />
				<NoticeSide notice={practice} shown={mode === Mode.practice} onAgain={onAgain} />
			</div>
		</section>
	);
}
//#endregion
//#region Playground app
export interface PlaygroundAppProps {
	ticket: Ticket | null;
	mode: Mode;
	online: boolean | null;
	arena: Notice;
	practice: Notice;
	playing: boolean;
	switchable: boolean;
	ready: boolean;
	onSwitch(mode: Mode): void;
	onAgain(): void;
	onLaunch(simulation: Simulation): void;
	onFinish(simulation: Simulation): void;
}

export function PlaygroundApp({ ticket, mode, online, arena, practice, playing, switchable, ready, onSwitch, onAgain, onLaunch, onFinish }: PlaygroundAppProps): ReactElement {
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
				<BoardNotice mode={mode} online={online} arena={arena} practice={practice} playing={playing} switchable={switchable} onSwitch={onSwitch} onAgain={onAgain} />
				{simulation === null || crosshair === null || ticket === null ? null : <Peek board={refBoard} crosshair={crosshair} simulation={simulation} ticket={ticket} />}
				<div id="toolkit" className="flex" inert={!ready && !playing}>
					{simulation === null || crosshair === null ? null : <Tray simulation={simulation} crosshair={crosshair} />}
				</div>
			</div>
		</main>
	);
}
//#endregion

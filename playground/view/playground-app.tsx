"use strict";

import "adaptive-extender/web";
import { type URI } from "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Simulation } from "../services/simulation.js";
import { type Ticket, type Allowance } from "../../arena/models/protocol.js";
import { Mode } from "../../settings/models/settings.js";
import { Crosshair } from "./crosshair.js";
import { type Notice } from "./notice.js";
import { Peek } from "./peek.js";
import { Scoreboard } from "./scoreboard.js";
import { Tray } from "./tray.js";
import { Tutorial } from "./tutorial.js";

const { ceil, max } = Math;

//#region Tickets
interface TicketsProps {
	online: boolean | null;
	allowance: Allowance | null;
}

// Not simplified: Tickets and NoticeSide repeat the countdown effect; a shared hook would be a top-level function (owner ruling).
function Tickets({ online, allowance }: TicketsProps): ReactElement {
	const [now, setNow] = useState<number>(Date.now);
	const deadline = useMemo(() => allowance === null || allowance.wait <= 0 ? null : Date.now() + allowance.wait, [allowance]);

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

	const loaded = online === true && allowance !== null;
	const minutes = deadline === null ? 0 : ceil(max(0, deadline - now) / 60000);
	let title = online === false ? "The arena is offline" : "Connecting to the arena…";
	if (loaded) title = `${allowance.left} of ${allowance.capacity} matches left`;
	return (
		<span className="tickets flex font-smaller-1" title={title} aria-busy={!loaded && online !== false}>
			<span>{loaded ? allowance.left : "–"}</span>
			<span className="icon in-line ticket"></span>
			<span hidden={deadline === null}>, next in {minutes}m</span>
		</span>
	);
}
//#endregion
//#region Mode switch
interface ModeSwitchProps {
	mode: Mode;
	online: boolean | null;
	allowance: Allowance | null;
	hidden: boolean;
	onSwitch(mode: Mode): void;
}

function ModeSwitch({ mode, online, allowance, hidden, onSwitch }: ModeSwitchProps): ReactElement {
	return (
		<fieldset id="mode" className="depth rounded" hidden={hidden}>
			<legend>Mode</legend>
			<span className="pill rounded"></span>
			<input id="arena" type="radio" name="mode" checked={mode === Mode.arena} disabled={online !== true} onChange={event => onSwitch(Mode.arena)} />
			<label htmlFor="arena" className="rounded with-padding small-padding">
				<span className="name">Arena</span>
				<Tickets online={online} allowance={allowance} />
			</label>
			<input id="practice" type="radio" name="mode" checked={mode === Mode.practice} onChange={event => onSwitch(Mode.practice)} />
			<label htmlFor="practice" className="rounded with-padding small-padding">
				<span className="name">Practice</span>
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
	const { deadline, since, target, action } = notice;

	useEffect(() => {
		setNow(Date.now());
		if (deadline === null && since === null) return;
		const interval = setInterval(() => {
			const current = Date.now();
			setNow(current);
			if (deadline !== null && current >= deadline) clearInterval(interval);
		}, 1000);
		return () => clearInterval(interval);
	}, [deadline, since]);

	return (
		<article className="flex column with-gap" inert={!shown} aria-busy={notice.busy}>
			<h2>{notice.title}</h2>
			<p className="description">{notice.description}</p>
			<footer>
				<p className="highlight" hidden={action !== null}>{notice.prompt(now)}</p>
				<a className="depth rounded with-padding" role="button" href={target?.href} hidden={target === null}>{action}</a>
				<button type="button" className="depth rounded with-padding" hidden={action === null || target !== null} onClick={event => onAgain()}>{action}</button>
			</footer>
		</article>
	);
}
//#endregion
//#region Board notice
interface BoardNoticeProps {
	mode: Mode;
	online: boolean | null;
	allowance: Allowance | null;
	arena: Notice;
	practice: Notice;
	playing: boolean;
	switchable: boolean;
	onSwitch(mode: Mode): void;
	onAgain(): void;
	onTeach(): void;
}

function BoardNotice({ mode, online, allowance, arena, practice, playing, switchable, onSwitch, onAgain, onTeach }: BoardNoticeProps): ReactElement {
	return (
		<section id="notice" className="layer rounded flex column with-gap with-padding large-padding" hidden={playing} aria-live="polite">
			<button id="help" type="button" className="rounded flex center" title="How to play" onClick={event => onTeach()}>
				<span className="icon"></span>
			</button>
			<ModeSwitch mode={mode} online={online} allowance={allowance} hidden={!switchable} onSwitch={onSwitch} />
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
	catalog: URI;
	ticket: Ticket | null;
	mode: Mode;
	online: boolean | null;
	allowance: Allowance | null;
	arena: Notice;
	practice: Notice;
	playing: boolean;
	switchable: boolean;
	tutorial: boolean;
	onSwitch(mode: Mode): void;
	onAgain(): void;
	onLearn(): void;
	onTeach(): void;
	onLaunch(simulation: Simulation): void;
	onFinish(simulation: Simulation): void;
	onFailure(message: string): void;
}

export function PlaygroundApp({ catalog, ticket, mode, online, allowance, arena, practice, playing, switchable, tutorial, onSwitch, onAgain, onLearn, onTeach, onLaunch, onFinish, onFailure }: PlaygroundAppProps): ReactElement {
	const [simulation, setSimulation] = useState<Simulation | null>(null);
	const [crosshair, setCrosshair] = useState<Crosshair | null>(null);
	const refBoard: RefObject<HTMLCanvasElement | null> = useRef(null);
	const refCrosshair: RefObject<HTMLDivElement | null> = useRef(null);
	// Not simplified: StrictMode runs the effect twice while the simulation state is still null; only this ref stops a second Simulation.
	const refSimulation: RefObject<Simulation | null> = useRef(null);

	useEffect(() => {
		const canvasBoard = refBoard.current;
		const divCrosshair = refCrosshair.current;
		if (canvasBoard === null || divCrosshair === null) return;
		if (refSimulation.current !== null) return;
		const created = refSimulation.current = new Simulation(canvasBoard, catalog);
		created.addEventListener("launch", event => onLaunch(created));
		created.addEventListener("finish", event => onFinish(created));
		created.addEventListener("failure", event => onFailure(event.message));
		setSimulation(created);
		setCrosshair(new Crosshair(divCrosshair, canvasBoard, created));
	}, [catalog, onLaunch, onFinish, onFailure]);

	useEffect(() => {
		if (simulation === null || ticket === null) return;
		simulation.show(ticket);
	}, [simulation, ticket]);

	const notice = mode === Mode.arena ? arena : practice;
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
				<BoardNotice mode={mode} online={online} allowance={allowance} arena={arena} practice={practice} playing={playing} switchable={switchable} onSwitch={onSwitch} onAgain={onAgain} onTeach={onTeach} />
				{simulation === null || crosshair === null || ticket === null ? null : <Peek board={refBoard} crosshair={crosshair} simulation={simulation} ticket={ticket} />}
				<div id="toolkit" className="flex">
					{simulation === null || crosshair === null ? null : <Tray simulation={simulation} crosshair={crosshair} ready={notice.playable || playing} />}
				</div>
			</div>
			<Tutorial open={tutorial} onClose={onLearn} />
		</main>
	);
}
//#endregion

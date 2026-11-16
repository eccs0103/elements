"use strict";

import "adaptive-extender/web";
import { Nullable } from "adaptive-extender/web";
import { Fragment, type ReactElement, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { type Element } from "../models/elements.js";
import { type Simulation } from "../services/simulation.js";
import { type Ticket } from "../../arena/models/protocol.js";
import { type AgentModel } from "../models/agent-catalog.js";
import { Sentence } from "../models/sentence.js";
import { type Cell, type Crosshair } from "./crosshair.js";
import { Swatch, Traits } from "./swatch.js";

//#region Chip
interface ChipProps {
	element: Element;
	compact: boolean;
}

function Chip({ element, compact }: ChipProps): ReactElement {
	const { name } = element;
	return (
		<span className={`chip flex alt-center with-gap small-gap${compact ? " compact" : String.empty}`} title={name}>
			<span className="tile rounded" style={Swatch.style(element)}></span>
			<span className="name font-smaller-2">{name}</span>
		</span>
	);
}
//#endregion
//#region Peek card
interface PeekCardProps {
	element: Element;
	holder: number | null;
	ticket: Ticket;
	model: AgentModel;
}

function PeekCard({ element, holder, ticket, model }: PeekCardProps): ReactElement {
	const { name, phase } = element;
	const { rate } = ticket.rules;
	const acts = useMemo(() => Sentence.acts(element, rate), [element, rate]);
	const stoppers = useMemo(() => Sentence.stoppers(element, rate), [element, rate]);
	let owner = model.name;
	if (holder === null) owner = "Neutral";
	else if (holder === ticket.human) owner = "Yours";
	return (
		<>
			<header className="flex alt-center with-gap">
				<span className="tile rounded" style={Swatch.style(element)}></span>
				<div className="flex column">
					<h3>{name}</h3>
					<span id="about" className="description font-smaller-2">{`${phase} · ${owner}`}</span>
				</div>
			</header>
			<ul id="traits" className="flex wrap with-gap small-gap">
				<Traits element={element} />
			</ul>
			<h4>Does</h4>
			<ol id="acts" className="flex column with-gap">
				{acts.map((sentence, index) => (
					<li key={index} className="flex column">
						<header className="description font-smaller-3">{sentence.when}</header>
						<p className="flex wrap alt-center with-gap small-gap">
							{sentence.phrases.map((phrase, number) => (
								<Fragment key={number}>
									{phrase.text}
									{phrase.elements.map(other => <Chip key={other.name} element={other} compact={phrase.compact} />)}
								</Fragment>
							))}
						</p>
					</li>
				))}
				{acts.length === 0 ? <li className="description">Nothing by itself: it only holds its ground.</li> : null}
			</ol>
			<h4>Stopped by</h4>
			<div className="flex wrap alt-center with-gap small-gap">
				{stoppers.elements.map(other => <Chip key={other.name} element={other} compact={stoppers.compact} />)}
				{stoppers.elements.length === 0 ? <span className="description">Nothing: only a drop can replace it.</span> : null}
			</div>
		</>
	);
}
//#endregion
//#region Peek
export interface PeekProps {
	board: RefObject<HTMLCanvasElement | null>;
	crosshair: Crosshair;
	simulation: Simulation;
	ticket: Ticket;
	model: AgentModel;
}

export function Peek({ board, crosshair, simulation, ticket, model }: PeekProps): ReactElement {
	const [pressed, setPressed] = useState<boolean>(false);
	const [bottom, setBottom] = useState<boolean>(false);
	const [present, setPresent] = useState<boolean>(false);
	const [shown, setShown] = useState<Element | null>(null);
	const [holder, setHolder] = useState<number | null>(null);
	const refPointer: RefObject<number | null> = useRef(null);
	const refTarget: RefObject<Cell | null> = useRef(null);

	useEffect(() => {
		const update = (event: Event): void => {
			const { inspected } = simulation;
			setPresent(inspected !== null);
			setHolder(simulation.holder);
			if (inspected === null) return;
			setShown(previous => previous !== null && previous.is(inspected) ? previous : inspected);
		};
		simulation.addEventListener("update", update);
		return () => simulation.removeEventListener("update", update);
	}, [simulation]);

	useEffect(() => {
		const canvasBoard = board.current;
		if (canvasBoard === null) return;

		const track = (event: PointerEvent): void => {
			if (event.pointerId !== refPointer.current) return;
			const { size } = crosshair;
			if (size === null) return;
			const cell = crosshair.aim(event);
			if (cell === refTarget.current) return;
			refTarget.current = cell;
			setBottom(cell !== null && cell.y < size / 2);
			simulation.inspect(Nullable.map(cell, cell => cell.index(size)));
		};

		const press = (event: PointerEvent): void => {
			if (refPointer.current !== null) return;
			if (event.pointerType === "mouse" && event.button !== 0) return;
			const { pointerId } = event;
			canvasBoard.setPointerCapture(pointerId);
			refPointer.current = pointerId;
			setPressed(true);
			track(event);
		};

		const release = (event: PointerEvent): void => {
			if (event.pointerId !== refPointer.current) return;
			refPointer.current = null;
			refTarget.current = null;
			crosshair.hide();
			setPressed(false);
			simulation.inspect(null);
		};

		const controller = new AbortController();
		const { signal } = controller;
		canvasBoard.addEventListener("pointerdown", press, { signal });
		canvasBoard.addEventListener("pointermove", track, { signal });
		canvasBoard.addEventListener("pointerup", release, { signal });
		canvasBoard.addEventListener("pointercancel", release, { signal });
		return () => controller.abort();
	}, [board, crosshair, simulation]);

	return (
		<section id="peek" className={`layer rounded flex column with-gap with-padding large-padding${bottom ? " bottom" : String.empty}`} hidden={!pressed || !present || shown === null}>
			{shown === null ? null : <PeekCard element={shown} holder={holder} ticket={ticket} model={model} />}
		</section>
	);
}
//#endregion

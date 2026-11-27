"use strict";

import "adaptive-extender/web";
import { type CSSProperties, type PointerEvent, type ReactElement, type RefObject, useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Simulation } from "../services/simulation.js";
import { type Crosshair } from "./crosshair.js";

const { body } = document;

//#region Tray
interface CardStyle extends CSSProperties {
	"--color": string;
}

interface HandStyle extends CSSProperties {
	"--charge": string;
}

export interface TrayProps {
	simulation: Simulation;
	crosshair: Crosshair;
	ready: boolean;
}

export function Tray({ simulation, crosshair, ready }: TrayProps): ReactElement {
	const [, refresh] = useReducer((version: number) => version + 1, 0);
	const [color, setColor] = useState<string | null>(null);
	const [name, setName] = useState<string>(String.empty);
	const refGhost: RefObject<HTMLSpanElement | null> = useRef(null);
	const refSlot: RefObject<number | null> = useRef(null);
	const { cards, charge } = simulation.status;

	useEffect(() => {
		const update = (event: Event): void => refresh();
		simulation.addEventListener("update", update);
		refresh();
		return () => simulation.removeEventListener("update", update);
	}, [simulation]);

	const follow = (event: PointerEvent<HTMLSpanElement>): void => {
		const spanGhost = refGhost.current;
		if (refSlot.current === null || spanGhost === null) return;
		const { style } = spanGhost;
		style.setProperty("--x", `${event.clientX}px`);
		style.setProperty("--y", `${event.clientY}px`);
		crosshair.aim(event.nativeEvent);
	};

	const grab = (event: PointerEvent<HTMLSpanElement>, slot: number): void => {
		if (simulation.status.charge < 1) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		refSlot.current = slot;
		const card = cards[slot];
		setColor(card.color.toString());
		setName(card.name);
		simulation.preview(ready);
		follow(event);
	};

	const cancel = (): void => {
		if (refSlot.current === null) return;
		refSlot.current = null;
		setColor(null);
		crosshair.hide();
		simulation.preview(false);
	};

	const release = (event: PointerEvent<HTMLSpanElement>): void => {
		const slot = refSlot.current;
		if (slot === null) return;
		const cell = crosshair.cell(event.nativeEvent);
		cancel();
		if (cell === null || !ready) return;
		simulation.drop(slot, cell.x, cell.y);
		simulation.launch();
	};

	const hand: HandStyle = { "--charge": `${charge}` };
	const ghost: CardStyle | undefined = color === null ? undefined : { "--color": color };
	return (
		<>
			<div id="hand" className="flex" style={hand}>
				{cards.map((card, slot) => {
					const style: CardStyle = { "--color": card.color.toString() };
					return <span key={slot} className="card rounded" title={card.name} style={style} onPointerDown={event => grab(event, slot)} onPointerMove={follow} onPointerUp={release} onPointerCancel={event => cancel()}></span>;
				})}
			</div>
			{createPortal(<span ref={refGhost} className={`ghost rounded${ready ? String.empty : " disabled"}`} hidden={color === null} style={ghost}>
				<span className="name layer rounded with-padding small-padding font-smaller-2">{name}</span>
			</span>, body)}
		</>
	);
}
//#endregion

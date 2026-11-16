"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { type Simulation } from "../services/simulation.js";
import { type Ticket } from "../../arena/models/protocol.js";

const { ceil, round, trunc } = Math;

//#region Scoreboard
export interface ScoreboardProps {
	simulation: Simulation;
	ticket: Ticket;
}

export function Scoreboard({ simulation, ticket }: ScoreboardProps): ReactElement {
	const { rules, human, model } = ticket;
	const { name } = model;
	const [left, setLeft] = useState<number>(rules.seconds);
	const [mine, setMine] = useState<number>(0);
	const [theirs, setTheirs] = useState<number>(0);
	const refRail: RefObject<HTMLDivElement | null> = useRef(null);

	useEffect(() => {
		const update = (event: Event): void => {
			const divRail = refRail.current;
			const { tick, tally } = simulation;
			setLeft(ceil((rules.length - tick) / rules.rate));
			if (divRail === null || tally === null) return;
			const area = rules.size ** 2;
			const owned = tally.scores[human] / area;
			const rival = tally.against(human) / area;
			divRail.style.setProperty("--mine", `${owned}`);
			divRail.style.setProperty("--theirs", `${rival}`);
			setMine(round(owned * 100));
			setTheirs(round(rival * 100));
		};
		simulation.addEventListener("update", update);
		return () => simulation.removeEventListener("update", update);
	}, [simulation, rules, human]);

	return (
		<div id="score">
			<div ref={refRail} className="rail">
				<div className={`side mine${mine > theirs ? " lead" : String.empty}`} title={`You ${mine}%`}>
					<span className="number">{`${mine}%`}</span>
					<span className="name">You</span>
				</div>
				<div className="stack">
					<span className="line"></span>
					<span className={`timer layer rounded with-padding small-padding${left > 0 && left <= 10 ? " alert" : String.empty}`}>{`${trunc(left / 60)}:${String(left % 60).padStart(2, "0")}`}</span>
				</div>
				<div className={`side${theirs > mine ? " lead" : String.empty}`} title={`${name} ${theirs}%`}>
					<span className="number">{`${theirs}%`}</span>
					<span className="name">{name}</span>
				</div>
			</div>
		</div>
	);
}
//#endregion

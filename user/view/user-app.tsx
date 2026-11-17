"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useLayoutEffect, useRef } from "react";
import { type History, type Game, type Summary, type Schedule } from "../../arena/models/protocol.js";
import { Calendar, Day } from "./calendar.js";

//#region Game item
interface GameItemProps {
	game: Game;
}

function GameItem({ game }: GameItemProps): ReactElement {
	const { model, started, verdict, human, area, outcome, reviewed, confirmed, left } = game;

	let status = "reviewing";
	let label = "In review";
	let note: string | null = null;
	if (reviewed) {
		status = "verified";
		label = "Verified";
	}
	if (reviewed && verdict !== null) label = `${verdict.percent(human, area)}% : ${verdict.rival(human, area)}%`;
	if (reviewed && !confirmed) {
		status = "rejected";
		label = "Rejected";
		note = "Your screen showed a win, but the server replay is a loss.";
	}
	if (left) {
		status = "left";
		label = "Left";
		note = "Left before the end, so it counts as a loss.";
	}

	return (
		<li className={`game flex alt-center with-gap ${outcome ? "win" : "loss"}`}>
			<div className="about flex column">
				<span className="rival"><b className="word">{outcome ? "Win" : "Loss"}</b>{` against ${model}`}</span>
				<span className="time">{Calendar.clock(started)}</span>
				<span className="note" hidden={note === null}>{note}</span>
			</div>
			<span className={`status flex alt-center ${status}`}>
				<span className="icon in-line"></span>
				<span>{label}</span>
			</span>
		</li>
	);
}
//#endregion
//#region Record card
interface RecordCardProps {
	summary: Summary | null;
}

function RecordCard({ summary }: RecordCardProps): ReactElement {
	const refBar: RefObject<HTMLSpanElement | null> = useRef(null);
	const rate = summary?.rate ?? null;

	useLayoutEffect(() => {
		const spanBar = refBar.current;
		if (spanBar === null) return;
		spanBar.style.setProperty("--wins", `${(rate ?? 0) / 100}`);
	}, [rate]);

	return (
		<section id="record" className="layer rounded flex column with-gap with-padding large-padding">
			<h3>Your record</h3>
			<div className="tally">
				<div className="stat win">
					<span className="number">{summary?.wins ?? "–"}</span>
					<span className="caption">Wins</span>
				</div>
				<div className="stat rate">
					<span className="number font-larger-5">{rate === null ? "–" : `${rate}%`}</span>
					<span className="caption">Win rate</span>
				</div>
				<div className="stat loss">
					<span className="number">{summary?.losses ?? "–"}</span>
					<span className="caption">Losses</span>
				</div>
			</div>
			<span ref={refBar} className="bar" hidden={rate === null}></span>
		</section>
	);
}
//#endregion
//#region Review strip
interface ReviewStripProps {
	summary: Summary | null;
	schedule: Schedule | null;
	now: number;
}

function ReviewStrip({ summary, schedule, now }: ReviewStripProps): ReactElement {
	const reviewing = summary?.reviewing ?? 0;
	const eta = schedule?.eta(now) ?? null;
	let when = "any moment now";
	if (eta !== null) when = `about ${Calendar.clock(eta)}, ${Calendar.until(eta, now)}`;

	return (
		<section id="review" className="layer rounded flex alt-center with-gap with-padding large-padding" hidden={reviewing === 0}>
			<span className="icon"></span>
			<div className="flex column">
				<p>{`${reviewing} ${reviewing === 1 ? "match" : "matches"} in review. Next server check ${when}.`}</p>
				<dfn className="description">The server replays every match to confirm its result.</dfn>
			</div>
		</section>
	);
}
//#endregion
//#region User app
export interface UserAppProps {
	history: History | null;
	trouble: string | null;
	now: number;
}

export function UserApp({ history, trouble, now }: UserAppProps): ReactElement {
	const games = history?.games ?? [];
	const days = Day.group(games, now);

	return (
		<main className="flex main-center">
			<div className="panel flex column with-gap with-padding large-padding">
				<RecordCard summary={history?.summary ?? null} />
				<ReviewStrip summary={history?.summary ?? null} schedule={history?.schedule ?? null} now={now} />
				<section id="matches" className="layer rounded flex column with-gap with-padding large-padding">
					<h3>Matches</h3>
					<p id="trouble" className="alert" hidden={trouble === null}>{trouble}</p>
					<p id="loading" className="description" hidden={history !== null}>Loading your matches…</p>
					<div id="empty" className="flex column alt-center with-gap" hidden={history === null || games.length > 0}>
						<span className="icon"></span>
						<p>No Arena matches yet.</p>
						<a href="../playground/" className="depth rounded with-padding highlight">Play in the Arena</a>
					</div>
					{days.map(day => (
						<section key={day.label} className="day flex column">
							<h4>{day.label}</h4>
							<ol className="games">
								{day.games.map(game => <GameItem key={game.id} game={game} />)}
							</ol>
						</section>
					))}
				</section>
			</div>
		</main>
	);
}
//#endregion

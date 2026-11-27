"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { type Simulation } from "../services/simulation.js";
import { Course, Progress, type Lesson } from "../services/course.js";
import { type AgentModel } from "../models/agent-catalog.js";
import { Swatch } from "./swatch.js";

const { body } = document;

//#region Pointer
interface PointerProps {
	lesson: Lesson;
	shown: boolean;
}

function Pointer({ lesson, shown }: PointerProps): ReactElement {
	const [aimed, setAimed] = useState<boolean>(false);
	const refPointer: RefObject<HTMLSpanElement | null> = useRef(null);

	useEffect(() => {
		const spanPointer = refPointer.current;
		if (spanPointer === null || !shown) return;
		const { style } = spanPointer;
		let frame: number | null = null;
		const measure = (): boolean => {
			const cards = Array.from(body.querySelectorAll("div#hand span.card"));
			const canvasBoard = body.querySelector("canvas#board");
			const { elements, rules } = lesson;
			if (canvasBoard === null || cards.length !== elements.length) return false;
			if (!cards.every(spanCard => elements.some(element => element.name === spanCard.getAttribute("title")))) return false;
			const card = cards[0].getBoundingClientRect();
			const board = canvasBoard.getBoundingClientRect();
			if (card.width === 0 || board.width === 0) return false;
			const { size, rows } = rules;
			style.setProperty("--from-x", `${card.left + card.width / 2}px`);
			style.setProperty("--from-y", `${card.top + card.height / 2}px`);
			style.setProperty("--to-x", `${board.left + board.width / 2}px`);
			style.setProperty("--to-y", `${board.bottom - board.height * rows / size / 2}px`);
			setAimed(true);
			return true;
		};
		// The hand shows the previous match until the lesson's first status renders, and the still board sends no later event: retry each frame until the hand holds this lesson's cards.
		const retry = (): void => {
			frame = measure() ? null : requestAnimationFrame(retry);
		};
		const aim = (event: Event): void => {
			measure();
		};
		retry();
		window.addEventListener("resize", aim);
		return () => {
			if (frame !== null) cancelAnimationFrame(frame);
			window.removeEventListener("resize", aim);
		};
	}, [lesson, shown]);

	return <span id="pointer" ref={refPointer} className="icon" hidden={!shown || !aimed} aria-hidden="true"></span>;
}
//#endregion
//#region Leave
interface LeaveProps {
	model: AgentModel | null;
	dialog: RefObject<HTMLDialogElement | null>;
	onLeave(): void;
}

function Leave({ model, dialog, onLeave }: LeaveProps): ReactElement {
	const close = (): void => {
		if (dialog.current?.returnValue !== "leave") return;
		onLeave();
	};

	return (
		<dialog id="leave" ref={dialog} className="pop-up layer rounded" aria-label="Leave training" onClose={event => close()}>
			<form method="dialog" className="container flex column with-gap with-padding large-padding">
				<h3>Leave training?</h3>
				<p hidden={model === null}><strong>{model?.name}</strong>: {model?.description}</p>
				<p>Without the basics, most first matches against the AI are lost. You can come back with the <span className="icon in-line help" aria-label="How to play"></span> button.</p>
				<footer className="flex with-gap">
					<button type="submit" value="stay" className="depth rounded with-padding">Keep training</button>
					<button type="submit" value="leave" className="rounded with-padding">Leave</button>
				</footer>
			</form>
		</dialog>
	);
}
//#endregion
//#region Coach
export interface CoachProps {
	simulation: Simulation;
	lesson: Lesson;
	model: AgentModel | null;
	trained: boolean;
	onProgress(progress: Progress): void;
	onNext(): void;
	onRetry(): void;
	onLeave(): void;
	onGraduate(): void;
}

export function Coach({ simulation, lesson, model, trained, onProgress, onNext, onRetry, onLeave, onGraduate }: CoachProps): ReactElement {
	const [progress, setProgress] = useState<Progress>(simulation.progress);
	const refLeave: RefObject<HTMLDialogElement | null> = useRef(null);
	const index = Course.index(lesson);
	const last = index === Course.length - 1;

	useEffect(() => {
		const update = (event: Event): void => {
			if (simulation.lesson !== lesson) return;
			const { progress } = simulation;
			setProgress(progress);
			if (progress !== Progress.running) onProgress(progress);
		};
		setProgress(simulation.lesson === lesson ? simulation.progress : Progress.running);
		simulation.addEventListener("lesson", update);
		return () => simulation.removeEventListener("lesson", update);
	}, [simulation, lesson, onProgress]);

	const skip = (): void => {
		if (trained) return onLeave();
		const dialog = refLeave.current;
		if (dialog === null) return;
		dialog.returnValue = String.empty;
		dialog.showModal();
	};

	const proceed = (): void => {
		if (progress === Progress.failed) return onRetry();
		if (last) return onGraduate();
		onNext();
	};

	let text = lesson.text;
	if (progress === Progress.passed) text = lesson.moral;
	if (progress === Progress.failed) text = lesson.failure;
	let action = "Next";
	if (last) action = "Play";
	if (progress === Progress.failed) action = "Try again";
	return (
		<>
			<section id="coach" className={`layer rounded flex column with-gap with-padding ${progress}`} aria-live="polite">
				<header className="flex alt-center with-gap">
					<ol className="dots flex with-gap" aria-label={`Lesson ${index + 1} of ${Course.length}`}>
						{Iterator.range(0, Course.length).map(number => <li key={number} className="rounded" aria-current={number === index}></li>).toArray()}
					</ol>
					<button type="button" className="skip rounded" hidden={last && progress === Progress.passed} onClick={event => skip()}>Skip</button>
				</header>
				<h2 className="flex alt-center with-gap small-gap">
					<span className="icon check"></span>
					{lesson.title}
				</h2>
				<p>{text}</p>
				<ul className="chips flex wrap with-gap small-gap" aria-label="Your cards">
					{lesson.elements.map(element => (
						<li key={element.name} className="chip depth rounded flex alt-center with-gap small-gap with-padding small-padding font-smaller-2">
							<span className="tile rounded" style={Swatch.style(element)}></span>
							{element.name}
						</li>
					))}
				</ul>
				<button type="button" className="proceed depth rounded with-padding highlight" hidden={progress === Progress.running} onClick={event => proceed()}>{action}</button>
			</section>
			<Pointer lesson={lesson} shown={index === 0 && progress === Progress.running} />
			<Leave model={model} dialog={refLeave} onLeave={onLeave} />
		</>
	);
}
//#endregion

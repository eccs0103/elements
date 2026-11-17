"use strict";

import "adaptive-extender/web";
import { type ReactElement, type RefObject, useEffect, useRef, useState } from "react";
import { Rules } from "../models/rules.js";

//#region Lesson
interface LessonProps {
	icon: string;
	title: string;
	text: string;
	shown: boolean;
}

function Lesson({ icon, title, text, shown }: LessonProps): ReactElement {
	return (
		<article className="flex column alt-center with-gap" inert={!shown} aria-hidden={!shown}>
			<span className={`icon ${icon}`}></span>
			<h3>{title}</h3>
			<p className="description">{text}</p>
		</article>
	);
}
//#endregion
//#region Tutorial
export interface TutorialProps {
	open: boolean;
	onClose(): void;
}

export function Tutorial({ open, onClose }: TutorialProps): ReactElement {
	const [step, setStep] = useState<number>(0);
	const refDialog: RefObject<HTMLDialogElement | null> = useRef(null);
	const { seconds, cooldown, hand, deck, rows } = new Rules();

	useEffect(() => {
		const dialog = refDialog.current;
		if (dialog === null || dialog.open === open) return;
		if (!open) return dialog.close();
		setStep(0);
		dialog.showModal();
	}, [open]);

	const lessons = [
		<Lesson key="humanity" icon="users" title="Humanity vs the AI" text="Every visitor plays the same AI. Each Arena win counts for all of Humanity." shown={step === 0} />,
		<Lesson key="goal" icon="trophy" title="Most cells wins" text={`A match lasts ${seconds} s. Whoever owns more cells at the end wins; a tie goes to you.`} shown={step === 1} />,
		<Lesson key="drag" icon="hand-pointer" title="Drag a card" text={`Drag a card from your hand onto your home, the ${rows} rows on your side of the board. The first drag starts the match.`} shown={step === 2} />,
		<Lesson key="cooldown" icon="clock" title={`A card every ${cooldown} s`} text={`After a drop, the next card is ready in ${cooldown} s. You hold ${hand} cards from your deck of ${deck}.`} shown={step === 3} />,
		<Lesson key="reactions" icon="fire" title="Elements react" text="Elements grow, burn and destroy each other, your own cells too. Tap an element on the Deck page to see what it does." shown={step === 4} />,
		<Lesson key="modes" icon="layer-group" title="Your deck, your mode" text="Pick your elements on the Deck page. Practice is free and not counted; Arena counts for Humanity." shown={step === 5} />,
	];
	const last = step === lessons.length - 1;

	const advance = (): void => {
		if (!last) return setStep(step + 1);
		refDialog.current?.close();
	};

	return (
		<dialog id="tutorial" ref={refDialog} className="pop-up layer rounded" aria-label="How to play" onClose={event => onClose()}>
			<div className="container flex column with-gap with-padding large-padding">
				<div className="lessons">{lessons}</div>
				<ol className="dots flex center with-gap" aria-label={`Step ${step + 1} of ${lessons.length}`}>
					{lessons.map((lesson, index) => <li key={lesson.key} className="rounded" aria-current={index === step}></li>)}
				</ol>
				<form method="dialog" className="flex with-gap">
					<button type="submit" className="skip rounded with-padding">Skip</button>
					<button type="button" className="depth rounded with-padding" disabled={step === 0} onClick={event => setStep(step - 1)}>Back</button>
					<button type="button" className="forward depth rounded with-padding" onClick={event => advance()}>
						<span aria-hidden={last}>Next</span>
						<span className="highlight" aria-hidden={!last}>Play</span>
					</button>
				</form>
			</div>
		</dialog>
	);
}
//#endregion

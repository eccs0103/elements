"use strict";

import "adaptive-extender/web";
import { type CSSProperties, Fragment, type MouseEvent, type ReactElement, type RefObject, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { Board } from "../../playground/services/board.js";
import { Painter } from "../../playground/services/painter.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { type DeckService } from "../../playground/services/deck-service.js";
import { Sentence } from "../../playground/models/sentence.js";
import { Swatch, Traits } from "../../playground/view/swatch.js";

const { trunc } = Math;

//#region Demo
class Demo {
	static #size: number = 21;
	static #resolution: number = 504;
	static #seconds: number = 5;
	static #seed: number = 1;
	#painter: Painter;
	#rate: number;
	#board: Board;
	#element: Element | null = null;
	#partner: Element | null = null;
	#start: number = 0;
	#ticks: number = 0;
	#frame: number | null = null;

	constructor(canvas: HTMLCanvasElement, rate: number) {
		const painter = this.#painter = new Painter(canvas.transferControlToOffscreen());
		const resolution = Demo.#resolution;
		painter.resize(resolution, resolution);
		this.#rate = rate;
		this.#board = new Board(Demo.#size, Demo.#seed);
	}

	static suggest(element: Element, rate: number): Element | null {
		for (const sentence of Sentence.acts(element, rate)) {
			const target = sentence.subjects.find(other => !other.is(PeriodicTable.ground));
			if (target !== undefined) return target;
		}
		return Sentence.threats(element, rate).at(0)?.subjects.at(0) ?? null;
	}

	static partner(partner: Element | null): Element | null {
		if (partner !== null && partner.is(PeriodicTable.ground)) return null;
		return partner;
	}

	play(element: Element, partner: Element | null): void {
		this.#element = element;
		this.#partner = partner;
		this.#reset(element, partner, performance.now());
		if (this.#frame === null) this.#request();
	}

	stop(): void {
		const frame = this.#frame;
		if (frame !== null) cancelAnimationFrame(frame);
		this.#frame = null;
	}

	#request(): void {
		this.#frame = requestAnimationFrame(this.#advance.bind(this));
	}

	#reset(element: Element, partner: Element | null, time: number): void {
		const size = Demo.#size;
		const board = this.#board = new Board(size, Demo.#seed);
		this.#start = time;
		this.#ticks = 0;
		const middle = trunc(size / 2);
		if (partner === null) return board.drop(element, middle, middle, 1);
		for (let y = 1; y < size; y += 3) {
			for (let x = 1; x < middle - 1; x += 3) {
				board.drop(partner, x, y, 2);
			}
		}
		for (let y = 4; y < size; y += 6) {
			board.drop(element, middle, y, 1);
		}
	}

	#advance(time: number): void {
		const element = this.#element;
		if (element === null) return;
		let start = this.#start;
		if (time - start > Demo.#seconds * 1000) {
			this.#reset(element, this.#partner, time);
			start = time;
		}
		const board = this.#board;
		const due = trunc((time - start) / 1000 * this.#rate);
		let ticks = this.#ticks;
		while (ticks < due) {
			board.step();
			ticks++;
		}
		this.#ticks = ticks;
		this.#painter.paint(board, null);
		this.#request();
	}
}
//#endregion
//#region Rows
interface DotStyle extends CSSProperties {
	"--step": string;
}

interface ChipProps {
	element: Element;
	compact: boolean;
	onWatch(element: Element): void;
}

function Chip({ element, compact, onWatch }: ChipProps): ReactElement {
	const { name } = element;
	return (
		<button type="button" className={`chip depth rounded flex alt-center with-gap small-gap${compact ? " compact" : String.empty}`} title={`Watch ${name} here`} aria-label={`Watch ${name}`} onClick={event => onWatch(element)}>
			<span className="tile rounded" style={Swatch.style(element)}></span>
			<span className="name font-smaller-2">{name}</span>
		</button>
	);
}

interface RowsProps {
	sentences: readonly Sentence[];
	empty: string;
	onWatch(element: Element): void;
}

function Rows({ sentences, empty, onWatch }: RowsProps): ReactElement {
	return (
		<ol className="rows flex column with-gap">
			{sentences.map((sentence, index) => (
				<li key={index} className="row flex column">
					<header className="description font-smaller-3">{sentence.when}</header>
					<p className="flex wrap alt-center with-gap small-gap">
						{sentence.phrases.map((phrase, number) => (
							<Fragment key={number}>
								{phrase.text === null ? null : <span>{phrase.text}</span>}
								{phrase.elements.map(element => <Chip key={element.name} element={element} compact={phrase.compact} onWatch={onWatch} />)}
							</Fragment>
						))}
					</p>
					<footer className="description font-smaller-3">{sentence.summary}</footer>
				</li>
			))}
			{sentences.length === 0 ? <li className="description">{empty}</li> : null}
		</ol>
	);
}
//#endregion
//#region Element dialog
export interface ElementDialogProps {
	deck: DeckService;
	element: Element | null;
	onClose(): void;
	onChange(): void;
}

export function ElementDialog({ deck, element, onClose, onChange }: ElementDialogProps): ReactElement {
	const [rate] = useState<number>(() => new Rules().rate);
	const [origin, setOrigin] = useState<Element | null>(null);
	const [history, setHistory] = useState<readonly Element[]>([]);
	const [partner, setPartner] = useState<Element | null>(null);
	const [round, replay] = useReducer((count: number) => count + 1, 0);
	const refDialog: RefObject<HTMLDialogElement | null> = useRef(null);
	const refBoard: RefObject<HTMLCanvasElement | null> = useRef(null);
	const refDemo: RefObject<Demo | null> = useRef(null);
	const current = history.at(-1) ?? null;

	if (element !== origin) {
		setOrigin(element);
		if (element !== null) {
			setHistory([element]);
			setPartner(Demo.partner(Demo.suggest(element, rate)));
		}
	}

	useEffect(() => {
		const canvasBoard = refBoard.current;
		if (canvasBoard === null || refDemo.current !== null) return;
		refDemo.current = new Demo(canvasBoard, rate);
	}, [rate]);

	useEffect(() => {
		const dialog = refDialog.current;
		if (dialog === null || dialog.open === (element !== null)) return;
		if (element !== null) {
			dialog.showModal();
			return;
		}
		dialog.close();
	}, [element]);

	useLayoutEffect(() => {
		const dialog = refDialog.current;
		if (dialog === null) return;
		dialog.scrollTop = 0;
	}, [current]);

	useEffect(() => {
		const demo = refDemo.current;
		if (demo === null || element === null || current === null) return;
		demo.play(current, partner);
	}, [element, current, partner, round]);

	const watch = (other: Element): void => {
		setPartner(Demo.partner(other));
		replay();
	};

	const follow = (): void => {
		if (partner === null) return;
		setHistory([...history, partner]);
		setPartner(Demo.partner(Demo.suggest(partner, rate)));
	};

	const back = (): void => {
		if (history.length < 2) return;
		const previous = history.slice(0, -1);
		setHistory(previous);
		setPartner(Demo.partner(Demo.suggest(previous[previous.length - 1], rate)));
	};

	const close = (): void => {
		refDemo.current?.stop();
		onClose();
	};

	const dismiss = (event: MouseEvent<HTMLDialogElement>): void => {
		if (event.target !== event.currentTarget) return;
		event.currentTarget.close();
	};

	const toggle = async (): Promise<void> => {
		if (current === null) return;
		try {
			deck.content.toggle(current);
			await deck.save();
		} catch (reason) {
			window.alert(Error.from(reason).message);
		}
		onChange();
	};

	const { content } = deck;
	const chosen = current !== null && content.holds(current);
	let offer = "Add to deck";
	if (chosen) offer = "Remove from deck";
	else if (content.full) offer = "Deck is full: drag it onto a slot to swap";
	const name = current?.name ?? null;
	const versus = partner === null ? `${name} alone on Dirt` : `${name} against ${partner.name}`;
	const steps: ReactElement[] = [];
	for (let step = -3; step <= 3; step++) {
		const style: DotStyle = { "--step": String(step + 3) };
		steps.push(<span key={step} className={`dot${step === current?.heat ? " on" : String.empty}`} style={style}></span>);
	}
	return (
		<dialog id="details" ref={refDialog} className="layer rounded" aria-labelledby="details-name" onClick={dismiss} onClose={close}>
			<div className="flex column with-gap large-gap with-padding large-padding">
				<header className="flex alt-center with-gap">
					<button type="button" className="back icon-button rounded flex center" title="Back" aria-label="Back" hidden={history.length < 2} onClick={event => back()}>
						<span className="icon"></span>
					</button>
					<span className="tile rounded" style={current === null ? undefined : Swatch.style(current)}></span>
					<div className="title flex column">
						<h2 id="details-name" className="name">{name}</h2>
						<span className="phase description">{current?.phase}</span>
					</div>
					<button type="button" className="close icon-button rounded flex center" title="Close" aria-label="Close" onClick={event => refDialog.current?.close()}>
						<span className="icon"></span>
					</button>
				</header>
				<ul className="traits flex wrap with-gap">
					{current === null ? null : <Traits element={current}><span className="scale flex alt-center">{steps}</span></Traits>}
				</ul>
				<figure className="demo flex column with-gap">
					<canvas ref={refBoard} className="board depth rounded"></canvas>
					<figcaption className="flex alt-center with-gap">
						<span>{versus}</span>
						<button type="button" className="open highlight" hidden={partner === null || current === null || partner.is(current)} onClick={event => follow()}>{partner === null ? null : `Open ${partner.name} ›`}</button>
					</figcaption>
				</figure>
				<section className="flex column with-gap">
					<h3>What it does</h3>
					<Rows sentences={current === null ? [] : Sentence.acts(current, rate)} empty="It does nothing by itself: it only holds its ground." onWatch={watch} />
				</section>
				<section className="flex column with-gap">
					<h3>What stops it</h3>
					<Rows sentences={current === null ? [] : Sentence.threats(current, rate)} empty="Nothing acts on it: only a drop can replace it." onWatch={watch} />
				</section>
				<footer className="flex column with-gap">
					<button type="button" className={`toggle rounded with-padding ${chosen ? "depth" : "highlight-background"}`} disabled={!chosen && content.full} onClick={event => void toggle()}>{offer}</button>
				</footer>
			</div>
		</dialog>
	);
}
//#endregion

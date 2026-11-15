"use strict";

import "adaptive-extender/web";
import { Random } from "adaptive-extender/web";
import { type CSSProperties, type MouseEvent, type PointerEvent, type ReactElement, type RefObject, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Phase, type Element } from "../../playground/models/elements.js";
import { Rules } from "../../playground/models/rules.js";
import { type DeckService } from "../../playground/services/deck-service.js";
import { PeriodicTable } from "../../playground/services/periodic-table.js";
import { Swatch } from "../../playground/view/swatch.js";

const { body } = document;
const { hypot } = Math;
const random = Random.global;

//#region Press
class Press {
	static #threshold: number = 6;
	static #delay: number = 200;
	static #buzz: number = 10;
	#button: HTMLButtonElement;
	#slot: number | null;
	#element: Element;
	#pointer: number;
	#mouse: boolean;
	#x: number;
	#y: number;
	#held: boolean = false;
	#dragging: boolean = false;

	constructor(button: HTMLButtonElement, event: PointerEvent<HTMLButtonElement>, slot: number | null, element: Element) {
		this.#button = button;
		this.#slot = slot;
		this.#element = element;
		this.#pointer = event.pointerId;
		this.#mouse = event.pointerType === "mouse";
		this.#x = event.clientX;
		this.#y = event.clientY;
	}

	static get delay(): number { return Press.#delay; }

	get slot(): number | null { return this.#slot; }
	get element(): Element { return this.#element; }
	get mouse(): boolean { return this.#mouse; }
	get held(): boolean { return this.#held; }
	get dragging(): boolean { return this.#dragging; }
	get captured(): boolean { return this.#held || this.#dragging; }

	get classes(): string {
		let classes = " pressing";
		if (this.#held) classes += " held";
		if (this.#dragging) classes += " lifted";
		return classes;
	}

	is(slot: number | null, element: Element): boolean {
		return this.#slot === slot && this.#element.is(element);
	}

	strays(event: PointerEvent<HTMLButtonElement>): boolean {
		return hypot(event.clientX - this.#x, event.clientY - this.#y) > Press.#threshold;
	}

	hold(): void {
		this.#held = true;
		this.#button.setPointerCapture(this.#pointer);
		if ("vibrate" in navigator) navigator.vibrate(Press.#buzz);
	}

	drag(): void {
		this.#dragging = true;
		this.#button.setPointerCapture(this.#pointer);
	}
}
//#endregion
//#region Deck builder
interface GhostStyle extends CSSProperties {
	"--color": string;
}

export interface DeckBuilderProps {
	deck: DeckService;
	onInspect(element: Element): void;
}

export function DeckBuilder({ deck, onInspect }: DeckBuilderProps): ReactElement {
	const [, refresh] = useReducer((version: number) => version + 1, 0);
	const [target, setTarget] = useState<number | null>(null);
	const [leaving, setLeaving] = useState<boolean>(false);
	const refDeck: RefObject<HTMLDivElement | null> = useRef(null);
	const refGhost: RefObject<HTMLSpanElement | null> = useRef(null);
	const refSlots: RefObject<(HTMLButtonElement | null)[]> = useRef([]);
	const refPress: RefObject<Press | null> = useRef(null);
	const refTimer: RefObject<number | null> = useRef(null);
	const refSwallow: RefObject<boolean> = useRef(false);
	const { content } = deck;
	const { elements, capacity } = content;
	const { hand } = useMemo(() => new Rules(), []);
	const groups = useMemo(() => Object.values(Phase).map(phase => PeriodicTable.placeable.filter(element => element.phase === phase)).filter(group => group.length > 0), []);
	const press = refPress.current;

	const disarm = (): void => {
		const timer = refTimer.current;
		if (timer !== null) clearTimeout(timer);
		refTimer.current = null;
	};

	const cancel = (): void => {
		disarm();
		refPress.current = null;
		setTarget(null);
		refresh();
	};

	useEffect(() => {
		const divDeck = refDeck.current;
		if (divDeck === null) return;
		const controller = new AbortController();
		const { signal } = controller;
		divDeck.addEventListener("touchmove", (event) => {
			if (refPress.current?.captured !== true) return;
			event.preventDefault();
		}, { passive: false, signal });
		document.addEventListener("keydown", (event) => {
			if (event.key !== "Escape" || refPress.current === null) return;
			refSwallow.current = true;
			cancel();
		}, { signal });
		return () => controller.abort();
	}, []);

	const commit = async (): Promise<void> => {
		refresh();
		await deck.save();
	};

	const guard = async (task: Promise<void>): Promise<void> => {
		try {
			await task;
		} catch (reason) {
			refresh();
			window.alert(Error.from(reason).message);
		}
	};

	const consume = (): boolean => {
		const swallow = refSwallow.current;
		refSwallow.current = false;
		return swallow;
	};

	const find = (x: number, y: number): number | null => {
		const buttonSlot = document.elementFromPoint(x, y)?.closest("button.slot");
		if (!(buttonSlot instanceof HTMLButtonElement)) return null;
		const slot = refSlots.current.indexOf(buttonSlot);
		return slot < 0 ? null : slot;
	};

	const aim = (press: Press, x: number, y: number): void => {
		const spanGhost = refGhost.current;
		if (spanGhost === null) return;
		const { style } = spanGhost;
		const spot = find(x, y);
		style.setProperty("--x", `${x}px`);
		style.setProperty("--y", `${y}px`);
		const card = press.slot === null;
		setLeaving(spot === null && !card);
		setTarget(card ? spot : null);
	};

	const movable = (press: Press): boolean => {
		const { slot } = press;
		if (slot === null) return !content.holds(press.element);
		return slot < content.elements.length;
	};

	const reach = (press: Press): void => {
		refTimer.current = null;
		press.hold();
		refresh();
	};

	const begin = (event: PointerEvent<HTMLButtonElement>, slot: number | null, element: Element | null): void => {
		refSwallow.current = false;
		cancel();
		if (!event.isPrimary || event.button !== 0 || element === null) return;
		const press = refPress.current = new Press(event.currentTarget, event, slot, element);
		refTimer.current = window.setTimeout(reach.bind(null, press), Press.delay);
		refresh();
	};

	const lift = (press: Press): void => {
		disarm();
		press.drag();
		refresh();
	};

	const follow = (event: PointerEvent<HTMLButtonElement>): void => {
		const press = refPress.current;
		if (press === null) return;
		if (press.dragging) return aim(press, event.clientX, event.clientY);
		if (!press.strays(event)) return;
		if (!press.held && !press.mouse) return cancel();
		if (!movable(press)) {
			refSwallow.current = press.held;
			return cancel();
		}
		lift(press);
		aim(press, event.clientX, event.clientY);
	};

	const drop = (press: Press, spot: number | null): void => {
		const { slot, element } = press;
		if (slot === null) {
			if (spot !== null) content.place(spot, element);
			return;
		}
		if (spot === null) content.remove(slot);
	};

	const release = async (event: PointerEvent<HTMLButtonElement>): Promise<void> => {
		const press = refPress.current;
		cancel();
		if (press === null) return;
		if (press.dragging) {
			refSwallow.current = true;
			drop(press, find(event.clientX, event.clientY));
			return await commit();
		}
		if (!press.held) return;
		refSwallow.current = true;
		onInspect(press.element);
	};

	const menu = (event: MouseEvent<HTMLButtonElement>, element: Element | null): void => {
		event.preventDefault();
		if (refPress.current !== null || element === null) return;
		onInspect(element);
	};

	const tap = async (slot: number): Promise<void> => {
		if (consume()) return;
		if (slot >= content.elements.length) return;
		content.remove(slot);
		await commit();
	};

	const pick = async (element: Element): Promise<void> => {
		if (consume()) return;
		if (!content.holds(element) && content.full) throw new RangeError(`The deck is full. Drag ${element.name} onto a slot to swap it in.`);
		content.toggle(element);
		await commit();
	};

	const fill = async (): Promise<void> => {
		content.fill(random);
		await commit();
	};

	const gesture = (slot: number | null, element: Element): string => {
		if (press === null || !press.is(slot, element)) return String.empty;
		return press.classes;
	};

	const slots: ReactElement[] = [];
	for (let slot = 0; slot < capacity; slot++) {
		const element = elements.at(slot) ?? null;
		const empty = element === null ? " empty" : String.empty;
		const marked = target === slot ? " target" : String.empty;
		const pressed = element === null ? String.empty : gesture(slot, element);
		const title = element === null ? "Empty slot: drop an element here" : `${element.name}: tap or drag out to remove, hold for details`;
		slots.push(
			<li key={slot}>
				<button type="button" ref={(buttonSlot) => { refSlots.current[slot] = buttonSlot; }} className={`card slot depth rounded flex column center with-padding${empty}${marked}${pressed}`} title={title} style={element === null ? undefined : Swatch.style(element)} onClick={event => void guard(tap(slot))} onPointerDown={event => begin(event, slot, element)} onPointerMove={follow} onPointerUp={event => void guard(release(event))} onPointerCancel={event => cancel()} onContextMenu={event => menu(event, element)}>
					<span className="tile rounded"></span>
					<span className="name font-smaller-2">{element === null ? "Empty" : element.name}</span>
				</button>
			</li>
		);
	}

	const ghost: GhostStyle | undefined = press === null || !press.dragging ? undefined : { "--color": press.element.color.toString() };
	return (
		<div id="deck" ref={refDeck} className="layer rounded flex column with-padding large-padding">
			<header className="layer flex column">
				<h3 className="flex">
					Deck
					<span className="flex alt-center with-gap">
						<button id="fill" type="button" className="depth rounded flex alt-center with-padding small-padding font-smaller-2" title="Fill the free places with random elements" hidden={content.full} onClick={event => void guard(fill())}>
							<span className="icon in-line"></span>
							<span className="with-inline-padding">Autofill</span>
						</button>
						<span className="description">{`${elements.length} / ${capacity}`}</span>
					</span>
				</h3>
				<span className="description">{`Tap to add or remove, drag to place, hold for details. In a match your hand holds ${hand} of these ${capacity} at random.`}</span>
				<ol id="slots" className="with-gap">{slots}</ol>
			</header>
			<div className="flex column with-gap large-gap">
				{groups.map(group => (
					<section key={group[0].phase} className="group flex column">
						<h4 className="phase flex">{group[0].phase}<span className="description">{String(group.length)}</span></h4>
						<ul className="cards with-gap">
							{group.map(element => {
								const { name, flammable, conductive } = element;
								const chosen = content.holds(element);
								const title = chosen ? `${name}: tap to remove, hold for details` : `${name}: tap to add, hold for details`;
								return (
									<li key={name}>
										<button type="button" className={`card depth rounded flex column center with-padding${chosen ? " chosen" : String.empty}${gesture(null, element)}`} title={title} style={Swatch.style(element)} onClick={event => void guard(pick(element))} onPointerDown={event => begin(event, null, element)} onPointerMove={follow} onPointerUp={event => void guard(release(event))} onPointerCancel={event => cancel()} onContextMenu={event => menu(event, element)}>
											<span className="tile rounded"></span>
											<span className="name font-smaller-2">{name}</span>
											<span className="marks flex center with-gap small-gap">
												<span className="icon flammable" title="Flammable" hidden={!flammable}></span>
												<span className="icon conductive" title="Conducts" hidden={!conductive}></span>
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					</section>
				))}
			</div>
			{createPortal(<span ref={refGhost} className={`ghost rounded${leaving ? " leaving" : String.empty}`} hidden={ghost === undefined} style={ghost}></span>, body)}
		</div>
	);
}
//#endregion

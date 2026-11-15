"use strict";

import "adaptive-extender/web";
import { type CSSProperties, type ReactElement, type ReactNode } from "react";
import { type Element } from "../models/elements.js";

//#region Swatch
export interface SwatchStyle extends CSSProperties {
	"--color": string;
	"--faded": string;
}

export class Swatch {
	static style(element: Element): SwatchStyle {
		return { "--color": element.color.toString(), "--faded": element.tint(0).toString() };
	}
}
//#endregion
//#region Traits
interface TraitProps {
	kind: string;
	text: string;
	children?: ReactNode;
}

function Trait({ kind, text, children }: TraitProps): ReactElement {
	return (
		<li className={`trait depth rounded flex alt-center with-gap small-gap with-padding small-padding font-smaller-2 ${kind}`}>
			<span className="icon"></span>
			{text}
			{children}
		</li>
	);
}

export interface TraitsProps {
	element: Element;
	children?: ReactNode;
}

export function Traits({ element, children }: TraitsProps): ReactElement {
	const { heat, flammable, conductive } = element;
	return (
		<>
			<Trait kind="heat" text={`Heat ${heat > 0 ? "+" : String.empty}${heat}`}>{children}</Trait>
			{flammable ? <Trait kind="flammable" text="Flammable" /> : null}
			{conductive ? <Trait kind="conductive" text="Conducts" /> : null}
		</>
	);
}
//#endregion

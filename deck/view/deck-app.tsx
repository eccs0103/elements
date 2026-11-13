"use strict";

import "adaptive-extender/web";
import { type ReactElement, useReducer, useState } from "react";
import { type Element } from "../../playground/models/elements.js";
import { type DeckService } from "../../playground/services/deck-service.js";
import { DeckBuilder } from "./deck-builder.js";
import { ElementDialog } from "./element-dialog.js";

//#region Deck app
export interface DeckAppProps {
	deck: DeckService;
}

export function DeckApp({ deck }: DeckAppProps): ReactElement {
	const [, refresh] = useReducer((version: number) => version + 1, 0);
	const [shown, setShown] = useState<Element | null>(null);

	return (
		<>
			<main className="flex main-center">
				<div className="panel flex column with-gap with-padding large-padding">
					<DeckBuilder deck={deck} onInspect={setShown} />
				</div>
			</main>
			<ElementDialog deck={deck} element={shown} onClose={() => setShown(null)} onChange={refresh} />
		</>
	);
}
//#endregion

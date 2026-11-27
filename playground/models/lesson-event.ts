"use strict";

import "adaptive-extender/core";
import { Field, Model } from "adaptive-extender/core";

//#region Lesson event
export interface LessonEventScheme {
	lesson: number;
	title: string;
}

export class LessonEvent extends Model {
	@Field(Number, { name: "lesson" })
	lesson: number;

	@Field(String, { name: "title" })
	title: string;

	constructor();
	constructor(lesson: number, title: string);
	constructor(lesson?: number, title?: string) {
		if (lesson === undefined || title === undefined) {
			super();
			return;
		}

		super();
		this.lesson = lesson;
		this.title = title;
	}
}
//#endregion

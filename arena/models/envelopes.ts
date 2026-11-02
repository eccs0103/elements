"use strict";

import "adaptive-extender/worker";
import { Field, Model, Nullable } from "adaptive-extender/worker";

//#region Letter
export interface LetterScheme {
	id: number;
	method: string;
	path: string;
	body: string | null;
}

export class Letter extends Model {
	@Field(Number)
	id: number;

	@Field(String)
	method: string;

	@Field(String)
	path: string;

	@Field(Nullable.Of(String))
	body: string | null;

	constructor();
	constructor(id: number, method: string, path: string, body: string | null);
	constructor(id?: number, method?: string, path?: string, body?: string | null) {
		if (id === undefined || method === undefined || path === undefined || body === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.method = method;
		this.path = path;
		this.body = body;
	}
}
//#endregion
//#region Reply
export interface ReplyScheme {
	id: number;
	status: number;
	body: string;
}

export class Reply extends Model {
	@Field(Number)
	id: number;

	@Field(Number)
	status: number;

	@Field(String)
	body: string;

	constructor();
	constructor(id: number, status: number, body: string);
	constructor(id?: number, status?: number, body?: string) {
		if (id === undefined || status === undefined || body === undefined) {
			super();
			return;
		}

		super();
		this.id = id;
		this.status = status;
		this.body = body;
	}
}
//#endregion

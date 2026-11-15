"use strict";

import "adaptive-extender/core";
import { Model, Field } from "adaptive-extender/core";

//#region Tensor
export interface TensorScheme {
	name: string;
	shape: number[];
	values: number[];
}

export class Tensor extends Model {
	@Field(String, { name: "name" })
	name: string;

	@Field(Array.Of(Number), { name: "shape" })
	shape: number[];

	@Field(Array.Of(Number), { name: "values" })
	values: number[];

	constructor();
	constructor(name: string, shape: number[], values: number[]);
	constructor(name?: string, shape?: number[], values?: number[]) {
		if (name === undefined || shape === undefined || values === undefined) {
			super();
			return;
		}

		super();
		this.name = name;
		this.shape = shape;
		this.values = values;
	}

	get data(): Float32Array { return Float32Array.from(this.values); }
}
//#endregion
//#region Weights
export interface WeightsScheme {
	matches: number;
	tensors: TensorScheme[];
}

export class Weights extends Model {
	@Field(Number, { name: "matches" })
	matches: number;

	@Field(Array.Of(Tensor), { name: "tensors" })
	tensors: Tensor[];

	constructor();
	constructor(matches: number, tensors: Tensor[]);
	constructor(matches?: number, tensors?: Tensor[]) {
		if (matches === undefined || tensors === undefined) {
			super();
			return;
		}

		super();
		this.matches = matches;
		this.tensors = tensors;
	}

	tensor(name: string): Tensor {
		return ReferenceError.suppress(this.tensors.find(item => item.name === name), `The weights hold no tensor '${name}'`);
	}
}
//#endregion

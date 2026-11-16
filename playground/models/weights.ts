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

	get data(): Float32Array { return Float32Array.from(this.values); }
}
//#endregion
//#region Weights
export interface WeightsScheme {
	tensors: TensorScheme[];
}

export class Weights extends Model {
	@Field(Array.Of(Tensor), { name: "tensors" })
	tensors: Tensor[];

	tensor(name: string): Tensor {
		return ReferenceError.suppress(this.tensors.find(item => item.name === name), `The weights hold no tensor '${name}'`);
	}
}
//#endregion

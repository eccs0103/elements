"use strict";

import "adaptive-extender/core";
import { type Weights } from "../models/weights.js";
import { type Observation } from "../models/observation.js";

const { max, min, ceil, trunc } = Math;

//#region Features
class Features {
	#channels: number;
	#size: number;
	#data: Float32Array;

	constructor(channels: number, size: number, data: Float32Array) {
		if (data.length !== channels * size * size) throw new RangeError(`The features hold ${data.length} values, not ${channels} × ${size}²`);
		this.#channels = channels;
		this.#size = size;
		this.#data = data;
	}

	static empty(channels: number, size: number): Features {
		return new Features(channels, size, new Float32Array(channels * size * size));
	}

	get channels(): number { return this.#channels; }
	get size(): number { return this.#size; }
	get data(): Float32Array { return this.#data; }

	relu(): Features {
		Dense.relu(this.#data);
		return this;
	}

	add(other: Features): Features {
		const data = this.#data;
		const source = other.#data;
		if (source.length !== data.length) throw new RangeError("Only features of one shape can be added");
		for (let index = 0; index < data.length; index++) {
			data[index] += source[index];
		}
		return this;
	}

	upsample(size: number): Features {
		const channels = this.#channels;
		const extent = this.#size;
		const data = this.#data;
		const result = Features.empty(channels, size);
		const target = result.#data;
		const scale = extent / size;
		for (let channel = 0; channel < channels; channel++) {
			for (let y = 0; y < size; y++) {
				const row = min(trunc(y * scale), extent - 1);
				for (let x = 0; x < size; x++) {
					const column = min(trunc(x * scale), extent - 1);
					target[(channel * size + y) * size + x] = data[(channel * extent + row) * extent + column];
				}
			}
		}
		return result;
	}
}
//#endregion
//#region Convolution
class Convolution {
	#weight: Float32Array;
	#bias: Float32Array;
	#outputs: number;
	#inputs: number;
	#kernel: number;
	#stride: number;

	constructor(weights: Weights, name: string, stride: number) {
		const tensor = weights.tensor(`${name}.weight`);
		const [outputs, inputs, kernel] = tensor.shape;
		this.#weight = tensor.data;
		this.#bias = weights.tensor(`${name}.bias`).data;
		this.#outputs = outputs;
		this.#inputs = inputs;
		this.#kernel = kernel;
		this.#stride = stride;
	}

	apply(features: Features): Features {
		const outputs = this.#outputs;
		const inputs = this.#inputs;
		const kernel = this.#kernel;
		const stride = this.#stride;
		const weight = this.#weight;
		const bias = this.#bias;
		const size = features.size;
		const source = features.data;
		if (features.channels !== inputs) throw new RangeError(`The convolution takes ${inputs} channels, not ${features.channels}`);
		const padding = (kernel - 1) / 2;
		const extent = trunc((size + 2 * padding - kernel) / stride) + 1;
		const result = Features.empty(outputs, extent);
		const target = result.data;
		for (let output = 0; output < outputs; output++) {
			const plane = output * extent * extent;
			target.fill(bias[output], plane, plane + extent * extent);
			for (let input = 0; input < inputs; input++) {
				const origin = input * size * size;
				for (let row = 0; row < kernel; row++) {
					for (let column = 0; column < kernel; column++) {
						const factor = weight[((output * inputs + input) * kernel + row) * kernel + column];
						const first = max(0, ceil((padding - column) / stride));
						const last = min(extent, trunc((size - 1 - column + padding) / stride) + 1);
						for (let y = 0; y < extent; y++) {
							const line = y * stride + row - padding;
							if (line < 0 || line >= size) continue;
							const from = origin + line * size + column - padding;
							const to = plane + y * extent;
							for (let x = first; x < last; x++) {
								target[to + x] += factor * source[from + x * stride];
							}
						}
					}
				}
			}
		}
		return result;
	}
}
//#endregion
//#region Dense
class Dense {
	#weight: Float32Array;
	#bias: Float32Array;
	#outputs: number;
	#inputs: number;

	constructor(weights: Weights, name: string) {
		const tensor = weights.tensor(`${name}.weight`);
		const [outputs, inputs] = tensor.shape;
		this.#weight = tensor.data;
		this.#bias = weights.tensor(`${name}.bias`).data;
		this.#outputs = outputs;
		this.#inputs = inputs;
	}

	apply(input: Float32Array): Float32Array {
		const outputs = this.#outputs;
		const inputs = this.#inputs;
		const weight = this.#weight;
		const bias = this.#bias;
		if (input.length !== inputs) throw new RangeError(`The layer takes ${inputs} values, not ${input.length}`);
		const result = new Float32Array(outputs);
		for (let output = 0; output < outputs; output++) {
			let sum = bias[output];
			for (let index = 0; index < inputs; index++) {
				sum += weight[output * inputs + index] * input[index];
			}
			result[output] = sum;
		}
		return result;
	}

	static relu(values: Float32Array): Float32Array {
		for (let index = 0; index < values.length; index++) {
			if (values[index] < 0) values[index] = 0;
		}
		return values;
	}
}
//#endregion
//#region Residual
class Residual {
	#convolution: Convolution;
	#convolution2: Convolution;

	constructor(weights: Weights, name: string) {
		this.#convolution = new Convolution(weights, `${name}.first`, 1);
		this.#convolution2 = new Convolution(weights, `${name}.second`, 1);
	}

	apply(features: Features): Features {
		const inner = this.#convolution.apply(features).relu();
		return this.#convolution2.apply(inner).add(features).relu();
	}
}
//#endregion
//#region Network
export class Network {
	#properties: Float32Array;
	#embedding: Float32Array;
	#width: number;
	#depth: number;
	#stem: Convolution;
	#full: readonly Residual[];
	#down: Convolution;
	#middle: Residual;
	#down2: Convolution;
	#bottom: readonly Residual[];
	#up2: Convolution;
	#up: Convolution;
	#head: Residual;
	#query: Dense;
	#query2: Dense;

	constructor(weights: Weights) {
		const properties = weights.tensor("properties");
		const embedding = weights.tensor("kinds.weight");
		this.#properties = properties.data;
		this.#embedding = embedding.data;
		this.#width = properties.shape[1];
		this.#depth = embedding.shape[1];
		this.#stem = new Convolution(weights, "stem", 1);
		this.#full = [0, 1, 2].map(index => new Residual(weights, `full.${index}`));
		this.#down = new Convolution(weights, "down", 2);
		this.#middle = new Residual(weights, "middle");
		this.#down2 = new Convolution(weights, "down2", 2);
		this.#bottom = [0, 1].map(index => new Residual(weights, `bottom.${index}`));
		this.#up2 = new Convolution(weights, "up2", 1);
		this.#up = new Convolution(weights, "up", 1);
		this.#head = new Residual(weights, "head");
		this.#query = new Dense(weights, "cards.0");
		this.#query2 = new Dense(weights, "cards.2");
	}

	#element(kind: number, target: Float32Array, offset: number, stride: number): void {
		const width = this.#width;
		const depth = this.#depth;
		const properties = this.#properties;
		const embedding = this.#embedding;
		for (let index = 0; index < width; index++) {
			target[offset + index * stride] = properties[kind * width + index];
		}
		for (let index = 0; index < depth; index++) {
			target[offset + (width + index) * stride] = embedding[kind * depth + index];
		}
	}

	#input(observation: Observation): Features {
		const { size, kinds, mine, theirs, budgets, planes } = observation;
		const area = size * size;
		const element = this.#width + this.#depth;
		const channels = element + 3 + planes.length;
		const data = new Float32Array(channels * area);
		for (let cell = 0; cell < area; cell++) {
			this.#element(kinds[cell], data, cell, area);
			data[element * area + cell] = mine[cell];
			data[(element + 1) * area + cell] = theirs[cell];
			data[(element + 2) * area + cell] = budgets[cell];
		}
		for (let index = 0; index < planes.length; index++) {
			data.fill(planes[index], (element + 3 + index) * area, (element + 4 + index) * area);
		}
		return new Features(channels, size, data);
	}

	#queries(cards: readonly number[]): Float32Array[] {
		const element = this.#width + this.#depth;
		return cards.map(kind => {
			const features = new Float32Array(element);
			this.#element(kind, features, 0, 1);
			return this.#query2.apply(Dense.relu(this.#query.apply(features)));
		});
	}

	decide(observation: Observation): number {
		let full = this.#stem.apply(this.#input(observation)).relu();
		for (const block of this.#full) {
			full = block.apply(full);
		}
		const middle = this.#middle.apply(this.#down.apply(full).relu());
		let bottom = this.#down2.apply(middle).relu();
		for (const block of this.#bottom) {
			bottom = block.apply(bottom);
		}
		middle.add(this.#up2.apply(bottom).upsample(middle.size));
		const features = this.#head.apply(full.add(this.#up.apply(middle).upsample(full.size)));
		const { reach } = observation;
		const area = features.size * features.size;
		const channels = features.channels;
		const data = features.data;
		const queries = this.#queries(observation.cards);
		let best = -1;
		let score = -Infinity;
		for (let slot = 0; slot < queries.length; slot++) {
			const query = queries[slot];
			for (let cell = 0; cell < area; cell++) {
				if (reach[cell] === 0) continue;
				let sum = 0;
				for (let channel = 0; channel < channels; channel++) {
					sum += data[channel * area + cell] * query[channel];
				}
				if (sum <= score) continue;
				score = sum;
				best = slot * area + cell;
			}
		}
		if (best < 0) throw new ReferenceError("The agent has no legal cell to play");
		return best;
	}
}
//#endregion

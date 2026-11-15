"use strict";

import "adaptive-extender/core";

const { imul } = Math;

//#region Dice
export class Dice {
	static roll(seed: number, tick: number, cell: number, slot: number): number {
		let value = seed ^ imul(tick, 0x9E3779B1) ^ imul(cell, 0x85EBCA77) ^ imul(slot, 0xC2B2AE3D);
		value = imul(value ^ (value >>> 16), 0x85EBCA6B);
		value = imul(value ^ (value >>> 13), 0xC2B2AE35);
		return (value ^ (value >>> 16)) >>> 0;
	}
}
//#endregion

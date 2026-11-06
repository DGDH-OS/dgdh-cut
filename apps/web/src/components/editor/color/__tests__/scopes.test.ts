import { describe, expect, test } from "bun:test";
import { VEC_SIZE, WAVE_H, computeScopes, rgbToCbCr } from "../scopes";

function solid(r: number, g: number, b: number, w = 16, h = 9) {
	const data = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < data.length; i += 4) {
		data[i] = r;
		data[i + 1] = g;
		data[i + 2] = b;
		data[i + 3] = 255;
	}
	return { data, w, h };
}

describe("scopes", () => {
	test("histogram van een egaal vlak heeft één piek per kanaal", () => {
		const { data, w, h } = solid(200, 100, 50);
		const s = computeScopes(data, w, h);
		expect(s.histogram.r[200]).toBe(w * h);
		expect(s.histogram.g[100]).toBe(w * h);
		expect(s.histogram.b[50]).toBe(w * h);
		expect(s.pixels).toBe(w * h);
	});
	test("waveform: elke kolom telt h pixels op het juiste niveau", () => {
		const { data, w, h } = solid(255, 0, 128);
		const s = computeScopes(data, w, h);
		expect(s.waveform.width).toBe(16);
		expect(s.waveform.counts[0][0 * WAVE_H + 255]).toBe(h);
		expect(s.waveform.counts[1][7 * WAVE_H + 0]).toBe(h);
		expect(s.waveform.counts[2][15 * WAVE_H + 128]).toBe(h);
	});
	test("vectorscope: grijs landt in het midden, rood boven (Cr hoog), blauw rechts (Cb hoog)", () => {
		const centre = Math.floor(VEC_SIZE / 2);
		const at = (rgb: [number, number, number]) => {
			const { data, w, h } = solid(...rgb);
			const s = computeScopes(data, w, h);
			const i = s.vector.counts.findIndex((v) => v > 0);
			return { x: Math.floor(i / VEC_SIZE), y: i % VEC_SIZE };
		};
		const grey = at([128, 128, 128]);
		expect(Math.abs(grey.x - centre)).toBeLessThanOrEqual(1);
		expect(Math.abs(grey.y - centre)).toBeLessThanOrEqual(1);
		expect(at([255, 0, 0]).y).toBeGreaterThan(centre + 20);
		expect(at([0, 0, 255]).x).toBeGreaterThan(centre + 20);
	});
	test("Cb/Cr van wit is nul", () => {
		const { cb, cr } = rgbToCbCr(1, 1, 1);
		expect(Math.abs(cb)).toBeLessThan(1e-9);
		expect(Math.abs(cr)).toBeLessThan(1e-9);
	});
});

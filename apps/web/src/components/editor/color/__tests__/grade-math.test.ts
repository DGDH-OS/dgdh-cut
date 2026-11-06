import { describe, expect, test } from "bun:test";
import {
	applyGrade,
	buildCubeLut,
	buildCurveLut,
	createDefaultGrade,
	evaluateCurve,
	gradeToUniforms,
	isIdentityGrade,
	parseCubeLut,
	puckToWheel,
	wheelToPuck,
	wheelToRgb,
	type GradeState,
	type Rgb,
} from "../grade-math";

const run = (grade: GradeState, rgb: Rgb) =>
	applyGrade(rgb, gradeToUniforms(grade), buildCurveLut(grade));
const near = (a: Rgb, b: Rgb, eps = 0.01) => a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(eps));

describe("grade-keten", () => {
	test("standaard is identiteit", () => {
		const g = createDefaultGrade();
		expect(isIdentityGrade(g)).toBe(true);
		for (const rgb of [[0, 0, 0], [0.25, 0.5, 0.75], [1, 1, 1], [0.9, 0.1, 0.4]] as Rgb[]) {
			near(run(g, rgb), rgb, 0.004);
		}
	});
	test("+1 stop verdubbelt middengrijs", () => {
		const g = { ...createDefaultGrade(), exposure: 1 };
		near(run(g, [0.25, 0.25, 0.25]), [0.5, 0.5, 0.5], 0.01);
	});
	test("verzadiging 0 geeft grijs op luma", () => {
		const g = { ...createDefaultGrade(), saturation: 0 };
		const [r, gg, b] = run(g, [1, 0, 0]);
		expect(Math.abs(r - 0.2126)).toBeLessThan(0.01);
		expect(Math.abs(gg - r)).toBeLessThan(0.005);
		expect(Math.abs(b - r)).toBeLessThan(0.005);
	});
	test("warm maakt rood sterker dan blauw", () => {
		const out = run({ ...createDefaultGrade(), temperature: 1 }, [0.5, 0.5, 0.5]);
		expect(out[0]).toBeGreaterThan(out[2]);
	});
	test("gain-wiel op rood tilt hooglichten naar rood", () => {
		const g = createDefaultGrade();
		g.gain = { hue: 0, amount: 0.4, luma: 0 };
		const out = run(g, [0.8, 0.8, 0.8]);
		expect(out[0]).toBeGreaterThan(out[1]);
		expect(out[1]).toBeGreaterThanOrEqual(out[2] - 0.01);
		// zwart blijft vrijwel zwart (gain werkt op hooglicht)
		near(run(g, [0, 0, 0]), [0, 0, 0], 0.01);
	});
	test("lift-wiel werkt vooral in de schaduwen", () => {
		const g = createDefaultGrade();
		g.lift = { hue: 240, amount: 0.5, luma: 0 };
		const dark = run(g, [0.05, 0.05, 0.05]);
		const bright = run(g, [0.95, 0.95, 0.95]);
		expect(dark[2] - dark[0]).toBeGreaterThan(bright[2] - bright[0]);
	});
	test("gamma-luma verhelderen middentonen, zwart/wit vast", () => {
		const g = createDefaultGrade();
		g.gamma = { hue: 0, amount: 0, luma: 0.5 };
		expect(run(g, [0.5, 0.5, 0.5])[0]).toBeGreaterThan(0.55);
		near(run(g, [0, 0, 0]), [0, 0, 0], 0.01);
		near(run(g, [1, 1, 1]), [1, 1, 1], 0.01);
	});
	test("contrast verhoogt afstand tot 0.5", () => {
		const out = run({ ...createDefaultGrade(), contrast: 0.5 }, [0.7, 0.7, 0.7]);
		expect(out[0]).toBeGreaterThan(0.7);
	});
});

describe("wielen", () => {
	test("offset is nulgemiddeld", () => {
		for (const hue of [0, 37, 90, 200, 300]) {
			const [r, g, b] = wheelToRgb({ hue, amount: 0.8, luma: 0 });
			expect(Math.abs(r + g + b)).toBeLessThan(1e-9);
		}
	});
	test("puck <-> wiel roundtrip", () => {
		const w = puckToWheel(0.3, -0.4, 0.2);
		const p = wheelToPuck(w);
		expect(p.x).toBeCloseTo(0.3, 6);
		expect(p.y).toBeCloseTo(-0.4, 6);
		expect(puckToWheel(3, 4, 0).amount).toBe(1);
	});
});

describe("curves", () => {
	test("identiteit en monotoniciteit", () => {
		const pts = [{ x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 }];
		let prev = -1;
		for (let i = 0; i <= 100; i++) {
			const y = evaluateCurve(pts, i / 100);
			expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
			prev = y;
		}
		expect(evaluateCurve(pts, 0.3)).toBeCloseTo(0.1, 6);
	});
	test("rode curve beinvloedt alleen rood", () => {
		const g = createDefaultGrade();
		g.curves.r = [{ x: 0, y: 0 }, { x: 0.5, y: 0.8 }, { x: 1, y: 1 }];
		const out = run(g, [0.5, 0.5, 0.5]);
		expect(out[0]).toBeGreaterThan(0.75);
		expect(Math.abs(out[1] - 0.5)).toBeLessThan(0.01);
	});
});

describe(".cube export", () => {
	test("size 17 identiteit: juiste aantal rijen en waarden", () => {
		const cube = parseCubeLut(buildCubeLut(createDefaultGrade(), 17));
		expect(cube.size).toBe(17);
		// rood wisselt snelst: rij 1 = (1/16, 0, 0)
		expect(cube.values[3]).toBeCloseTo(1 / 16, 2);
		expect(cube.values[4]).toBeCloseTo(0, 2);
		const last = cube.values.length - 3;
		expect(cube.values[last]).toBeCloseTo(1, 2);
	});
	test("grade zit in de LUT", () => {
		const g = { ...createDefaultGrade(), exposure: 1 };
		const cube = parseCubeLut(buildCubeLut(g, 9));
		const idx = (r: number, gg: number, b: number) => (b * 81 + gg * 9 + r) * 3;
		// (0.25,0.25,0.25) -> ~0.5
		expect(cube.values[idx(2, 2, 2)]).toBeCloseTo(0.5, 1);
	});
	test("ongeldige grootte", () => {
		expect(() => buildCubeLut(createDefaultGrade(), 1)).toThrow();
	});
});

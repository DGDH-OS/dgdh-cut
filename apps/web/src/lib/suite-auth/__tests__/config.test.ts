import { describe, expect, test } from "bun:test";
import { isPublicPath } from "../config";

describe("isPublicPath", () => {
	test.each([
		"/manifest.json",
		"/browserconfig.xml",
		"/favicon.ico",
		"/icon.svg",
		"/apple-touch-icon.png",
		"/open-graph/default.png",
		"/icons/icon-192.png",
		"/open-graph/default.jpg",
		"/api/health",
	])("public: %s", (p) => expect(isPublicPath(p)).toBe(true));

	test.each([
		"/",
		"/projects",
		"/agent",
		"/api/engine/x",
		"/api/mcp",
		"/api/v1/tools",
		"/manifest.json/x",
		"/open-graph",
		"/open-graph/",
		"/icons/../projects",
		"/editor/abc",
	])("gated: %s", (p) => expect(isPublicPath(p)).toBe(false));
});

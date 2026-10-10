// src/ を文字で調べる受け入れ基準(AC-3・AC-4・AC-5・AC-17)と manifest(AC-14 の一部)。毎回のテストで回して戻りを防ぐ。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n);
		return statSync(p).isDirectory() ? sources(p) : p.endsWith(".ts") ? [p] : [];
	});
}

const src = sources("src").map((p) => ({ p, text: readFileSync(p, "utf8") }));
const hits = (words: string[]) => src.flatMap(({ p, text }) => words.filter((w) => text.includes(w)).map((w) => `${p}: ${w}`));

describe("src/ の文字の検査", () => {
	it("AC-3: 書き込み系と本文の読み取りが 0 件(INV-1・INV-8)", () => {
		expect(hits(["vault.modify", "vault.create", "vault.delete", "vault.trash", "vault.rename", "vault.process",
			"vault.append", "adapter.", "fileManager", "cachedRead", "vault.read("])).toEqual([]);
	});

	it("AC-4: HTML を文字で入れる書き方が 0 件(INV-6)", () => {
		expect(hits(["innerHTML", "outerHTML", "insertAdjacentHTML"])).toEqual([]);
	});

	it("AC-5: Node・Electron・通信が 0 件(INV-2・INV-3)", () => {
		const mods = ["fs", "path", "electron", "child_process"].flatMap((m) => [`from "${m}"`, `from '${m}'`, `from "node:${m}"`, `from 'node:${m}'`]);
		expect(hits(["require(", ...mods, "fetch(", "requestUrl", "XMLHttpRequest", "WebSocket"])).toEqual([]);
	});

	it("AC-17: settings.ts に利用者固有の値が無い(INV-5)", () => {
		const text = readFileSync("src/settings.ts", "utf8");
		for (const w of ["日報", "開発ログ", "週報", "copilot", "E:"]) expect(text.includes(w), w).toBe(false);
	});

	it("正規表現の後読みを使わない(古い iOS)", () => {
		expect(hits(["(?" + "<=", "(?" + "<!"])).toEqual([]);   // 文字を分けて書く(この行が lint の後読み判定に当たらないように)
	});
});

describe("manifest(§9.1)", () => {
	const m = JSON.parse(readFileSync("manifest.json", "utf8")) as Record<string, unknown>;
	it("isDesktopOnly が false、id の決まり、description の文字", () => {
		expect(m.isDesktopOnly).toBe(false);
		expect(m.id).toMatch(/^[a-z-]+$/);
		expect(String(m.id)).not.toMatch(/obsidian|plugin$/);
		expect(m.description).toMatch(/^[A-Za-z0-9 .,!?'"-]+\.$/);
		expect(String(m.description).length).toBeLessThanOrEqual(250);
		expect(m.fundingUrl).toBeUndefined();
	});
});

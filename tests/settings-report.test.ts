// 設定の読み込みの補い(§9.2・§10)、設定画面の文字との行き来、無視リスト(FR-10)、コピーするレポートの形(§9.5)のテスト。
import { describe, expect, it } from "vitest";
import { runAll } from "../src/checks/index";
import { applyIgnore, countOf } from "../src/ignore";
import type { Finding, VaultSnapshot } from "../src/model";
import { buildReport } from "../src/report";
import {
	DEFAULTS, formatNamingRule, formatPlacementRule, normalizeSettings, parseNamingRules, parsePlacementRules,
} from "../src/settings";
import { S, useLanguage } from "../src/strings";

const f = (check: Finding["check"], path: string, key: string, extra: Partial<Finding> = {}): Finding =>
	({ check, key, path, detail: "", severity: "error", ...extra });

describe("設定の読み込み", () => {
	it("無い・欠けた項目は既定で埋める", () => {
		expect(normalizeSettings(null)).toEqual({ settings: DEFAULTS, problem: null });
		const { settings } = normalizeSettings({ schemaVersion: 1, excludeFolders: ["\\Foo\\", "/Bar/"], autoRefresh: "yes" });
		expect(settings.excludeFolders).toEqual(["Foo", "Bar"]);
		expect(settings.autoRefresh).toBe(DEFAULTS.autoRefresh);
		expect(settings.residuePatterns).toEqual(DEFAULTS.residuePatterns);
	});

	it("schemaVersion が違う・形が壊れていれば既定で動き、知らせる", () => {
		expect(normalizeSettings({ schemaVersion: 2, excludeFolders: ["Foo"] })).toEqual({ settings: DEFAULTS, problem: "schema" });
		expect(normalizeSettings([1, 2]).problem).toBe("broken");
		expect(normalizeSettings("x").problem).toBe("broken");
	});

	it("既定値を書き換えない(読み込むたびに写しを作る)", () => {
		const a = normalizeSettings(null).settings;
		a.ignored.push("x");
		expect(DEFAULTS.ignored).toEqual([]);
	});
});

describe("設定画面の文字", () => {
	it("命名規則: フォルダ | 正規表現、/** で配下も、/ は vault 直下。正規表現の中の | はそのまま", () => {
		const { rules, errors } = parseNamingRules("Log | ^\\d{4}\\.md$\nNotes/** | ^(a|b)\n/ | ^x\n** | ^y\nbad line\nX |  ");
		expect(rules).toEqual([
			{ folder: "Log", pattern: "^\\d{4}\\.md$", includeSubfolders: false },
			{ folder: "Notes", pattern: "^(a|b)", includeSubfolders: true },
			{ folder: "", pattern: "^x", includeSubfolders: false },
			{ folder: "", pattern: "^y", includeSubfolders: true },
		]);
		expect(errors).toEqual([5, 6]);
		expect(rules.map(formatNamingRule)).toEqual(["Log | ^\\d{4}\\.md$", "Notes/** | ^(a|b)", "/ | ^x", "** | ^y"]);
	});

	it("置き場所規則: 拡張子 | フォルダ | フォルダ", () => {
		const { rules, errors } = parsePlacementRules(".PDF, png | Files | Archive/Old\npdf\n| Files");
		expect(rules).toEqual([{ extensions: ["pdf", "png"], allowedFolders: ["Files", "Archive/Old"] }]);
		expect(errors).toEqual([2, 3]);
		expect(rules.map(formatPlacementRule)).toEqual(["pdf png | Files | Archive/Old"]);
	});
});

describe("無視リスト(FR-10)", () => {
	const findings = [
		f("orphan", "a.md", "orphan|a.md"),
		f("duplicate-name", "x/r.md", "duplicate-name|r.md", { group: "r.md", detail: "r.md" }),
		f("duplicate-name", "y/r.md", "duplicate-name|r.md", { group: "r.md", detail: "r.md" }),
	];

	it("当たった項目を除き、無視の件数はキーの数、当たらないキーも数える", () => {
		const shown = applyIgnore(findings, ["duplicate-name|r.md", "orphan|gone.md"]);
		expect(shown.findings.map((x) => x.path)).toEqual(["a.md"]);
		expect(shown.ignoredCount).toBe(1);
		expect(shown.staleIgnores).toBe(1);
	});

	it("重複ファイル名の件数は組の数", () => {
		expect(countOf(findings, "duplicate-name")).toBe(1);
		expect(countOf(findings, "orphan")).toBe(1);
	});
});

describe("レポート(§9.5)", () => {
	const snap: VaultSnapshot = {
		files: [{ path: "a|b.md", name: "a|b.md", ext: "md", size: 0, mtime: 0 }],
		links: [{ source: "a|b.md", link: "gone", linkpath: "gone", subpath: "", line: 4, dest: null, subpathFound: null }],
		incoming: {}, takenAt: 0, resolvedSeen: true,
	};
	const at = new Date(2026, 8, 25, 21, 0).getTime();

	it("サマリの表、検査ごとの表、0 件は None、落ちた検査が無ければ節を出さない", () => {
		useLanguage("en");
		const r = runAll(snap, structuredClone(DEFAULTS));
		const md = buildReport(r, applyIgnore(r.findings, []), at, S);
		expect(md).toContain("# Vault health report 2026-09-25 21:00\nFiles scanned: 1 / Excluded: 0 / Ignored: 0\n");
		expect(md).toContain("| Broken links | 1 |\n| Orphan notes | 1 |\n| Duplicate names | 0 groups |");
		expect(md).toContain("## Broken links\n| Source | Line | Link |\n|---|---|---|\n| a\\|b.md | 5 | gone |");
		expect(md).toContain("## Leftover files\n| Path | Reason |\n|---|---|\n| a\\|b.md | 0-byte note |");
		expect(md).toContain("## Duplicate names\nNone");
		expect(md).not.toContain("Failed checks");
	});

	it("落ちた検査を出す。日本語表示なら見出しも日本語(FR-16)", () => {
		useLanguage("ja");
		const r = { ...runAll(snap, structuredClone(DEFAULTS)), errors: [{ check: "naming" as const, message: "boom" }] };
		const md = buildReport(r, applyIgnore(r.findings, []), at, S);
		expect(md).toContain("# vault 健康診断レポート 2026-09-25 21:00");
		expect(md).toContain("## 落ちた検査\n- 命名規則違反: boom");
		useLanguage("en");
	});
});

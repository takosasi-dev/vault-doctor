// 6検査・除外・runAll の合成スナップショットでのテスト(AC-2・AC-11 の論理・AC-12・AC-19)。実 vault の名前は使わない(D-14)。
import { describe, expect, it } from "vitest";
import { brokenLinks, isAbsoluteLink } from "../src/checks/brokenLinks";
import { duplicateNames } from "../src/checks/duplicateNames";
import { CHECKS, runAll } from "../src/checks/index";
import { naming } from "../src/checks/naming";
import { orphans } from "../src/checks/orphans";
import { placement } from "../src/checks/placement";
import { EMPTY_NOTE, residue } from "../src/checks/residue";
import { globToRegExp } from "../src/glob";
import type { SnapFile, SnapLink, VaultSnapshot } from "../src/model";
import { DEFAULTS, type Settings } from "../src/settings";

function file(path: string, size = 10): SnapFile {
	const name = path.split("/").pop() ?? path;
	const dot = name.lastIndexOf(".");
	return { path, name, ext: dot < 0 ? "" : name.slice(dot + 1), size, mtime: 0 };
}

function link(source: string, l: string, dest: string | null, extra: Partial<SnapLink> = {}): SnapLink {
	return { source, link: l, linkpath: l.split("#")[0] ?? "", subpath: "", line: 3, dest, subpathFound: null, ...extra };
}

function snap(files: SnapFile[], links: SnapLink[] = [], incoming: Record<string, number> = {}): VaultSnapshot {
	return { files, links, incoming, takenAt: 0, resolvedSeen: true };
}

const settings = (over: Partial<Settings> = {}): Settings => ({ ...structuredClone(DEFAULTS), ...over });
const paths = (o: { findings: { path: string }[] }) => o.findings.map((f) => f.path).sort();

describe("glob", () => {
	it("* と ? だけを特別扱いし、大文字小文字を区別しない", () => {
		const re = globToRegExp("????-??-??.md");
		expect(re.test("2026-09-25.md")).toBe(true);
		expect(re.test("2026-09-25_x.md")).toBe(false);
		expect(globToRegExp("Untitled*").test("untitled 2.md")).toBe(true);
		expect(globToRegExp("a.md").test("aXmd")).toBe(false);          // . はそのまま
		expect(globToRegExp("(x)[1]+.md").test("(x)[1]+.md")).toBe(true);
	});
});

describe("リンク切れ(FR-1・FR-2・FR-3)", () => {
	const s = snap([file("a.md"), file("b.md")], [
		link("a.md", "missing", null, { line: 4 }),
		link("a.md", "b", "b.md"),
		link("a.md", "nope", null, { line: undefined, property: "related" }),
		link("a.md", "E:/Vault/Daily", null),
		link("a.md", "b#No heading", "b.md", { subpath: "#No heading", subpathFound: false }),
		link("a.md", "b#Heading", "b.md", { subpath: "#Heading", subpathFound: true }),
	]);

	it("解決先が無いリンクを、参照元・行・リンク文字列で出す。解決したリンクは出さない", () => {
		const out = brokenLinks(s, settings()).findings;
		expect(out.map((f) => f.detail)).toEqual(["missing", "nope", "E:/Vault/Daily"]);
		expect(out[0]).toMatchObject({ path: "a.md", line: 4, severity: "error", key: "broken-link|a.md|missing" });
		expect(out[1]).toMatchObject({ property: "related", line: undefined });
	});

	it("絶対パスのリンクを見分ける", () => {
		expect(isAbsoluteLink("E:/Vault/Daily")).toBe(true);
		expect(isAbsoluteLink("D:\\notes\\x.md")).toBe(true);
		expect(isAbsoluteLink("file:///C:/x.md")).toBe(true);
		expect(isAbsoluteLink("notes/E:/x")).toBe(false);
		expect(isAbsoluteLink("Daily")).toBe(false);
	});

	it("見出し・ブロックの欠けは設定が ON のときだけ警告で出す", () => {
		expect(brokenLinks(s, settings()).findings.some((f) => f.severity === "warning")).toBe(false);
		const warn = brokenLinks(s, settings({ checkSubpaths: true })).findings.filter((f) => f.severity === "warning");
		expect(warn.map((f) => f.detail)).toEqual(["b#No heading"]);
	});
});

describe("孤立ノート(FR-4)", () => {
	const s = snap([file("a.md"), file("b.md"), file("Daily/2026-01-01.md"), file("pic.png")], [], { "b.md": 1 });

	it("被リンク 0 の md を出し、被リンクのある md と md 以外は出さない", () => {
		expect(paths(orphans(s, settings()))).toEqual(["Daily/2026-01-01.md", "a.md"]);
	});

	it("孤立除外フォルダの配下は出さない", () => {
		expect(paths(orphans(s, settings({ orphanExemptFolders: ["Daily"] })))).toEqual(["a.md"]);
	});
});

describe("重複ファイル名(FR-5)", () => {
	it("別フォルダの同名を組で出し、ただ1つの名前は出さない", () => {
		const out = duplicateNames(snap([file("x/README.md"), file("y/README.md"), file("z/other.md")]), settings()).findings;
		expect(out.map((f) => f.path)).toEqual(["x/README.md", "y/README.md"]);
		expect(new Set(out.map((f) => f.key))).toEqual(new Set(["duplicate-name|readme.md"]));
	});

	it("NFD と NFC、大文字小文字だけ違う名前も同じ組にする(D-13・§10)", () => {
		const nfd = "x/" + "ノート.md".normalize("NFD");
		const out = duplicateNames(snap([file(nfd), file("y/ノート.md"), file("p/Note.md"), file("q/note.md")]), settings()).findings;
		expect(new Set(out.map((f) => f.group))).toEqual(new Set(["ノート.md", "note.md"]));
		expect(out.find((f) => f.path === nfd)?.path).toBe(nfd);      // 表示は実際の名前
	});

	it("重複を許す名前のパターンに当たる名前は出さない", () => {
		const s = snap([file("a/2026-01-01.md"), file("b/2026-01-01.md"), file("a/README.md"), file("b/README.md")]);
		expect(duplicateNames(s, settings({ duplicateAllowedNames: ["????-??-??.md", "readme.md"] })).findings).toEqual([]);
	});
});

describe("命名規則(FR-6・FR-18)", () => {
	const s = snap([file("Log/2026-01-01.md"), file("Log/memo.md"), file("Log/old/x.md"), file("top.md")]);

	it("規則のフォルダ直下で合わない名前を、規則と一緒に出す。配下のフォルダは含まない", () => {
		const out = naming(s, settings({ namingRules: [{ folder: "Log", pattern: "^\\d{4}-\\d{2}-\\d{2}\\.md$", includeSubfolders: false }] }));
		expect(paths(out)).toEqual(["Log/memo.md"]);
		expect(out.findings[0]?.detail).toBe("Log | ^\\d{4}-\\d{2}-\\d{2}\\.md$");
	});

	it("配下も含む規則と、vault 直下の規則。合う名前は出さない", () => {
		const rule = (folder: string, pattern: string, includeSubfolders: boolean) => settings({ namingRules: [{ folder, pattern, includeSubfolders }] });
		expect(paths(naming(s, rule("Log", "^\\d", true)))).toEqual(["Log/memo.md", "Log/old/x.md"]);
		expect(paths(naming(s, rule("Log", "^[a-z0-9-]+\\.md$", true)))).toEqual([]);
		expect(paths(naming(s, rule("", "^x", false)))).toEqual(["top.md"]);
	});

	it("構文エラーの規則だけ無効にし、ほかの規則は続ける(AC-11)", () => {
		const out = naming(s, settings({ namingRules: [
			{ folder: "Log", pattern: "(", includeSubfolders: false },
			{ folder: "Log", pattern: "^\\d", includeSubfolders: false },
		] }));
		expect(out.invalid?.map((r) => r.rule)).toEqual(["Log | ("]);
		expect(paths(out)).toEqual(["Log/memo.md"]);
	});
});

describe("残骸(FR-7)", () => {
	const s = snap([file("Untitled 2.md"), file("a/無題のファイル.base"), file("empty.md", 0), file("props.md", 40),
		file("blank.txt", 0), file("notes.md")]);

	it("パターンに当たる名前と 0 バイトの md を出す", () => {
		const out = residue(s, settings());
		expect(paths(out)).toEqual(["Untitled 2.md", "a/無題のファイル.base", "empty.md"]);
		expect(out.findings.find((f) => f.path === "empty.md")?.detail).toBe(EMPTY_NOTE);
	});

	it("0 バイトの md を残骸にしない設定・frontmatter だけの md・0 バイトの md 以外は出さない", () => {
		expect(paths(residue(s, settings({ emptyNoteIsResidue: false })))).toEqual(["Untitled 2.md", "a/無題のファイル.base"]);
	});
});

describe("置き場所(FR-8)", () => {
	const rule = { extensions: ["pdf", "png"], allowedFolders: ["Files"] };
	const s = snap([file("Files/a.pdf"), file("Files/sub/b.PNG"), file("FilesOld/c.pdf"), file("d.pdf"), file("e.csv")]);

	it("許可フォルダの外にある、規則の拡張子のファイルを出す", () => {
		const out = placement(s, settings({ placementRules: [rule] }));
		expect(paths(out)).toEqual(["FilesOld/c.pdf", "d.pdf"]);
		expect(out.findings[0]?.detail).toBe("pdf png | Files");
	});

	it("規則が1つでも許せば出さない", () => {
		const out = placement(s, settings({ placementRules: [rule, { extensions: ["pdf"], allowedFolders: ["FilesOld"] }] }));
		expect(paths(out)).toEqual(["d.pdf"]);
	});
});

describe("runAll", () => {
	const all = snap([file("Foo/a.md", 0), file("FooBar/a.md", 0), file("Foo/Untitled.md"), file("FooBar/Untitled.md"),
		file("Foo/x.pdf"), file("FooBar/x.pdf"), file("FooBar/sub/x.pdf")],
	[link("Foo/a.md", "gone", null), link("FooBar/a.md", "gone", null)]);
	const s = settings({
		excludeFolders: ["Foo"],
		namingRules: [{ folder: "", pattern: "^z", includeSubfolders: true }],
		placementRules: [{ extensions: ["pdf"], allowedFolders: ["Elsewhere"] }],
	});

	it("除外フォルダ Foo の配下は6検査のどれにも出ず、FooBar の配下は出る(AC-19)", () => {
		const r = runAll(all, s);
		expect(r.findings.some((f) => f.path.startsWith("Foo/"))).toBe(false);
		const checks = new Set(r.findings.filter((f) => f.path.startsWith("FooBar/")).map((f) => f.check));
		expect(checks).toEqual(new Set(["broken-link", "orphan", "duplicate-name", "naming", "residue", "placement"]));
		expect(r.excluded).toBe(3);
		expect(r.scanned).toBe(4);
	});

	it("例外を投げる検査が1つあっても、残り5検査の結果と CheckError 1件を返す(AC-12)", () => {
		const boom = CHECKS.map((c) => (c.id === "orphan" ? { id: c.id, run: () => { throw new Error("boom"); } } : c));
		const r = runAll(all, settings(), boom);
		expect(r.errors).toEqual([{ check: "orphan", message: "boom" }]);
		expect(r.findings.some((f) => f.check === "orphan")).toBe(false);
		expect(r.findings.some((f) => f.check === "broken-link")).toBe(true);
		expect(r.findings.some((f) => f.check === "residue")).toBe(true);
	});

	it("ファイルが無い vault は全部 0 件でエラーにしない(§10)", () => {
		expect(runAll(snap([]), settings())).toEqual({ findings: [], errors: [], invalid: [], scanned: 0, excluded: 0 });
	});
});

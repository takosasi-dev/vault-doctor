// 6検査をまとめて走らせる runAll。除外フォルダ(FR-9)を先に1か所で落とし、検査ごとに try/catch する(INV-7・FR-17)。
// 落ちた検査は CheckError、無効な規則は InvalidRule として返す。obsidian を import しない。
import { inFolder } from "../glob";
import type { CheckError, CheckId, CheckOutput, Finding, InvalidRule, VaultSnapshot } from "../model";
import type { Settings } from "../settings";
import { brokenLinks } from "./brokenLinks";
import { duplicateNames } from "./duplicateNames";
import { naming } from "./naming";
import { orphans } from "./orphans";
import { placement } from "./placement";
import { residue } from "./residue";

export interface Check { id: CheckId; run: (snap: VaultSnapshot, s: Settings) => CheckOutput; }

export const CHECKS: Check[] = [
	{ id: "broken-link", run: brokenLinks },
	{ id: "orphan", run: orphans },
	{ id: "duplicate-name", run: duplicateNames },
	{ id: "naming", run: naming },
	{ id: "residue", run: residue },
	{ id: "placement", run: placement },
];

export interface RunResult {
	findings: Finding[];
	errors: CheckError[];
	invalid: InvalidRule[];
	scanned: number;   // 除外を引いたファイル数
	excluded: number;  // 除外フォルダの配下で落としたファイル数
}

export function runAll(snap: VaultSnapshot, s: Settings, checks: Check[] = CHECKS): RunResult {
	const out = (path: string) => s.excludeFolders.some((d) => inFolder(path, d));
	const files = snap.files.filter((f) => !out(f.path));
	// 被リンク(incoming)は Obsidian の数のまま使う。除外フォルダからのリンクも数える(仮決め。NOTES)
	const view: VaultSnapshot = { ...snap, files, links: snap.links.filter((l) => !out(l.source)) };
	const result: RunResult = { findings: [], errors: [], invalid: [], scanned: files.length, excluded: snap.files.length - files.length };
	for (const c of checks) {
		try {
			const o = c.run(view, s);
			result.findings.push(...o.findings);
			result.invalid.push(...(o.invalid ?? []));
		} catch (e) {
			result.errors.push({ check: c.id, message: e instanceof Error ? e.message : String(e) });
		}
	}
	return result;
}

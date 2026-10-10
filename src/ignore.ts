// 無視リストの当てはめ(FR-10)と件数の数え方。無視キーに当たった項目を一覧から除き、当たったキーの数と当たらないキーの数を返す。
// 重複ファイル名の件数は組の数で数える(§9.5)。obsidian を import しない。
import type { CheckId, Finding } from "./model";

export interface Shown {
	findings: Finding[];
	ignoredCount: number;   // 何かに当たった無視キーの数(サマリの「無視」)
	staleIgnores: number;   // どの項目にも当たっていない無視キーの数(§10)
}

export function applyIgnore(findings: Finding[], ignored: string[]): Shown {
	const keys = new Set(ignored);
	const hit = new Set<string>();
	const shown = findings.filter((f) => {
		if (!keys.has(f.key)) return true;
		hit.add(f.key);
		return false;
	});
	return { findings: shown, ignoredCount: hit.size, staleIgnores: keys.size - hit.size };
}

/** 検査の件数。重複ファイル名は組の数 */
export function countOf(findings: Finding[], check: CheckId): number {
	const of = findings.filter((f) => f.check === check);
	return check === "duplicate-name" ? new Set(of.map((f) => f.group)).size : of.length;
}

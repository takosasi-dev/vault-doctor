// 命名規則違反(FR-6): 規則のフォルダ(直下だけ、または配下全部)にあるファイルの名前(拡張子込み・NFC)が正規表現に合わない物。
// 正規表現が作れない規則(構文エラー・古い iOS の後読み)はその規則だけ無効として返し、ほかは続ける(FR-18)。obsidian を import しない。
import { inFolder, nfc, parentOf } from "../glob";
import type { CheckOutput, Finding, InvalidRule, VaultSnapshot } from "../model";
import { formatNamingRule, type Settings } from "../settings";

export function naming(snap: VaultSnapshot, s: Settings): CheckOutput {
	const findings: Finding[] = [];
	const invalid: InvalidRule[] = [];
	for (const rule of s.namingRules) {
		const label = formatNamingRule(rule);
		let re: RegExp;
		try {
			re = new RegExp(rule.pattern);
		} catch (e) {
			invalid.push({ check: "naming", rule: label, message: e instanceof Error ? e.message : String(e) });
			continue;
		}
		for (const f of snap.files) {
			const inside = rule.includeSubfolders ? inFolder(f.path, rule.folder) : parentOf(f.path) === rule.folder;
			if (inside && !re.test(nfc(f.name))) {
				findings.push({ check: "naming", key: `naming|${nfc(f.path)}`, path: f.path, detail: label, severity: "error" });
			}
		}
	}
	return { findings, invalid };
}

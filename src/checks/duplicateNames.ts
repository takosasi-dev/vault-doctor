// 重複ファイル名(FR-5): 拡張子込みの名前(NFC・小文字)が同じファイルを組にする。大文字小文字だけ違う物も組になる(§10)。
// 「重複を許す名前」のワイルドカードに当たる名前は出さない。1 ファイル 1 件で出し、無視キーは組で共通。obsidian を import しない。
import { globToRegExp, nfc } from "../glob";
import type { CheckOutput, Finding, SnapFile, VaultSnapshot } from "../model";
import type { Settings } from "../settings";

export function duplicateNames(snap: VaultSnapshot, s: Settings): CheckOutput {
	const allowed = s.duplicateAllowedNames.map(globToRegExp);
	const groups = new Map<string, SnapFile[]>();
	for (const f of snap.files) {
		const name = nfc(f.name);
		if (allowed.some((re) => re.test(name))) continue;
		const k = name.toLowerCase();
		const g = groups.get(k);
		if (g) g.push(f);
		else groups.set(k, [f]);
	}
	const findings: Finding[] = [];
	for (const [k, files] of groups) {
		if (files.length < 2) continue;
		for (const f of files) {
			findings.push({ check: "duplicate-name", key: `duplicate-name|${k}`, path: f.path, detail: k, group: k, severity: "error" });
		}
	}
	return { findings };
}

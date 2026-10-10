// 残骸(FR-7): 名前が残骸パターン(`*` `?`、大文字小文字を区別しない)に当たるファイルと、0 バイトの md。
// 本文は読まないので、frontmatter だけの md は残骸にしない(§10・INV-8)。obsidian を import しない。
import { globToRegExp, nfc } from "../glob";
import type { CheckOutput, Finding, VaultSnapshot } from "../model";
import type { Settings } from "../settings";

/** 0 バイトの md の理由(画面とレポートで言語に合わせて置き換える) */
export const EMPTY_NOTE = "0 bytes";

export function residue(snap: VaultSnapshot, s: Settings): CheckOutput {
	const patterns = s.residuePatterns.map((p) => [p, globToRegExp(p)] as const);
	const findings: Finding[] = [];
	for (const f of snap.files) {
		const name = nfc(f.name);
		const reasons = patterns.filter(([, re]) => re.test(name)).map(([p]) => p);
		if (s.emptyNoteIsResidue && f.ext === "md" && f.size === 0) reasons.push(EMPTY_NOTE);
		if (reasons.length) {
			findings.push({ check: "residue", key: `residue|${nfc(f.path)}`, path: f.path, detail: reasons.join(" / "), severity: "error" });
		}
	}
	return { findings };
}

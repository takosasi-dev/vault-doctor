// リンク切れ(FR-1)と見出し・ブロックの欠け(FR-3、警告)。判定はスナップショットの解決先(Obsidian のリンク解決。D-2)だけで行う。
// 絶対パスリンクの見分け(FR-2)もここに置く。obsidian を import しない。
import { nfc } from "../glob";
import type { CheckOutput, Finding, SnapLink, VaultSnapshot } from "../model";
import type { Settings } from "../settings";

/** ドライブ文字(E:/ D:\)か file:/// で始まるリンク。ほかの端末では必ず切れる(FR-2) */
export function isAbsoluteLink(link: string): boolean {
	return /^([a-z]:[\\/]|file:\/\/\/)/i.test(link);
}

const finding = (l: SnapLink, severity: Finding["severity"]): Finding => ({
	check: "broken-link",
	key: `broken-link|${nfc(l.source)}|${nfc(l.link)}`,
	path: l.source,
	detail: l.link,
	line: l.line,
	property: l.property,
	severity,
});

export function brokenLinks(snap: VaultSnapshot, s: Settings): CheckOutput {
	const findings: Finding[] = [];
	for (const l of snap.links) {
		if (l.dest === null) findings.push(finding(l, "error"));
		else if (s.checkSubpaths && l.subpathFound === false) findings.push(finding(l, "warning"));
	}
	return { findings };
}

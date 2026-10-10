// 置き場所規則違反(FR-8): 規則の拡張子のファイルが、置いてよいフォルダのどれの配下にも無い物。
// 同じ拡張子を持つ規則が複数あれば、どれか1つで許されれば出さない。obsidian を import しない。
import { inFolder, nfc } from "../glob";
import type { CheckOutput, Finding, VaultSnapshot } from "../model";
import { formatPlacementRule, type Settings } from "../settings";

export function placement(snap: VaultSnapshot, s: Settings): CheckOutput {
	const findings: Finding[] = [];
	for (const f of snap.files) {
		const ext = f.ext.toLowerCase();
		const rules = s.placementRules.filter((r) => r.extensions.includes(ext));
		if (!rules.length || rules.some((r) => r.allowedFolders.some((d) => inFolder(f.path, d)))) continue;
		findings.push({
			check: "placement", key: `placement|${nfc(f.path)}`, path: f.path,
			detail: rules.map(formatPlacementRule).join(" / "), severity: "error",
		});
	}
	return { findings };
}

// 孤立ノート(FR-4): md のうち、自分以外からの被リンクが 0 の物。孤立除外フォルダの配下は出さない。
// 被リンクはスナップショットの incoming(Obsidian の resolvedLinks から数えた物)を使う。obsidian を import しない。
import { inFolder, nfc } from "../glob";
import type { CheckOutput, Finding, VaultSnapshot } from "../model";
import type { Settings } from "../settings";

export function orphans(snap: VaultSnapshot, s: Settings): CheckOutput {
	return {
		findings: snap.files
			.filter((f) => f.ext === "md" && !snap.incoming[f.path] && !s.orphanExemptFolders.some((d) => inFolder(f.path, d)))
			.map((f): Finding => ({ check: "orphan", key: `orphan|${nfc(f.path)}`, path: f.path, detail: "", severity: "error" })),
	};
}

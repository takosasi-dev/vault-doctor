// 検出結果とスナップショットの型(§9.4・§2)。検査・画面・レポートが共有する。
// obsidian を import しない(検査とテストが読む。D-7)。
export type CheckId = "broken-link" | "orphan" | "duplicate-name" | "naming" | "residue" | "placement";

/** 画面とレポートに並べる順 */
export const CHECK_IDS: CheckId[] = ["broken-link", "orphan", "duplicate-name", "naming", "residue", "placement"];

export interface Finding {
	check: CheckId;
	key: string;          // 無視キー(§9.4)
	path: string;         // 対象ファイル(リンク切れは参照元)
	detail: string;       // リンク切れ: リンク文字列 / 命名・残骸・置き場所: 当たった規則 / 重複: グループ名 / 孤立: 空文字
	line?: number;        // リンク切れのみ(0 始まり)
	property?: string;    // frontmatter のリンク切れのみ
	group?: string;       // 重複ファイル名のグループ
	severity: "error" | "warning";
}

export interface SnapFile {
	path: string;   // 実際のパス(表示用。比べるときは NFC にする)
	name: string;   // 拡張子込みの名前
	ext: string;    // 拡張子(点なし。Obsidian の TFile.extension のまま)
	size: number;
	mtime: number;
}

export interface SnapLink {
	source: string;             // 参照元(md)
	link: string;               // メタデータキャッシュのリンク文字列(見出し・ブロックを含む)
	linkpath: string;           // getLinkpath 後
	subpath: string;            // "#見出し" "#^id"。無ければ ""
	line?: number;              // 本文のリンク(0 始まり)
	property?: string;          // frontmatter のリンク
	dest: string | null;        // Obsidian が選んだ解決先。null = 切れている(D-2)
	subpathFound: boolean | null; // 見出し・ブロックが解決先にあるか。調べなかったら null
}

export interface VaultSnapshot {
	files: SnapFile[];
	links: SnapLink[];
	incoming: Record<string, number>; // 自分以外からの被リンク元の数(resolvedLinks から)
	takenAt: number;
	resolvedSeen: boolean;            // resolved を一度でも受けたか(§10)
}

export interface CheckError { check: CheckId; message: string; }
export interface InvalidRule { check: CheckId; rule: string; message: string; }
export interface CheckOutput { findings: Finding[]; invalid?: InvalidRule[]; }

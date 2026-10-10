// 設定の型・既定値(§9.2。利用者固有の値は入れない INV-5)・読み込みの補い・設定画面の文字との行き来。
// 欠けた項目は既定で埋め、形が違えば既定で動いて data.json を上書きしない(呼び手が保存を止める)。obsidian を import しない。
import { normFolder } from "./glob";

export interface NamingRule { folder: string; pattern: string; includeSubfolders: boolean; }
export interface PlacementRule { extensions: string[]; allowedFolders: string[]; }

export interface Settings {
	schemaVersion: 1;
	excludeFolders: string[];
	orphanExemptFolders: string[];
	duplicateAllowedNames: string[];
	namingRules: NamingRule[];
	residuePatterns: string[];
	emptyNoteIsResidue: boolean;
	placementRules: PlacementRule[];
	checkSubpaths: boolean;
	autoRefresh: boolean;
	autoRefreshDelayMs: number;
	ignored: string[];
}

export const DEFAULTS: Settings = {
	schemaVersion: 1,
	excludeFolders: [],
	orphanExemptFolders: [],
	duplicateAllowedNames: [],
	namingRules: [],
	residuePatterns: ["Untitled*", "無題のファイル*"],   // Obsidian の新規ファイルの既定名(英語と日本語)
	emptyNoteIsResidue: true,
	placementRules: [],
	checkSubpaths: false,                                // FR-3
	autoRefresh: true,                                   // 仮決め(§8.6 の計測待ち。NOTES)
	autoRefreshDelayMs: 5000,                            // 仮決め(同上)
	ignored: [],
};

export type LoadProblem = "schema" | "broken" | null;

const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const folders = (list: string[]): string[] => list.map(normFolder).filter((f) => f !== "");
const exts = (list: string[]): string[] => list.map((e) => e.trim().replace(/^\./, "").toLowerCase()).filter((e) => e !== "");

/** data.json の中身を Settings にする。schemaVersion が違う・形が壊れていれば既定(problem で知らせる) */
export function normalizeSettings(raw: unknown): { settings: Settings; problem: LoadProblem } {
	const base = structuredClone(DEFAULTS);
	if (raw === null || raw === undefined) return { settings: base, problem: null };
	if (typeof raw !== "object" || Array.isArray(raw)) return { settings: base, problem: "broken" };
	const r = raw as Record<string, unknown>;
	if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return { settings: base, problem: "schema" };
	const list = (k: keyof Settings): string[] => { const v = r[k]; return isStrList(v) ? v : (base[k] as string[]); };
	const bool = (k: keyof Settings): boolean => { const v = r[k]; return typeof v === "boolean" ? v : (base[k] as boolean); };
	const naming = Array.isArray(r.namingRules)
		? (r.namingRules as unknown[]).filter((x): x is NamingRule => typeof x === "object" && x !== null
			&& typeof (x as NamingRule).folder === "string" && typeof (x as NamingRule).pattern === "string")
			.map((x) => ({ folder: normFolder(x.folder), pattern: x.pattern, includeSubfolders: x.includeSubfolders === true }))
		: base.namingRules;
	const placement = Array.isArray(r.placementRules)
		? (r.placementRules as unknown[]).filter((x): x is PlacementRule => typeof x === "object" && x !== null
			&& isStrList((x as PlacementRule).extensions) && isStrList((x as PlacementRule).allowedFolders))
			.map((x) => ({ extensions: exts(x.extensions), allowedFolders: folders(x.allowedFolders) }))
		: base.placementRules;
	const delay = typeof r.autoRefreshDelayMs === "number" && Number.isInteger(r.autoRefreshDelayMs) && r.autoRefreshDelayMs >= 0
		? r.autoRefreshDelayMs : base.autoRefreshDelayMs;
	return {
		settings: {
			schemaVersion: 1,
			excludeFolders: folders(list("excludeFolders")),
			orphanExemptFolders: folders(list("orphanExemptFolders")),
			duplicateAllowedNames: list("duplicateAllowedNames"),
			namingRules: naming,
			residuePatterns: list("residuePatterns"),
			emptyNoteIsResidue: bool("emptyNoteIsResidue"),
			placementRules: placement,
			checkSubpaths: bool("checkSubpaths"),
			autoRefresh: bool("autoRefresh"),
			autoRefreshDelayMs: delay,
			ignored: list("ignored"),
		},
		problem: null,
	};
}

// ---- 設定画面の文字(1行に1つ)との行き来。区切りの | は Obsidian のファイル名に使えない文字なので、フォルダ名とぶつからない

/** 1行に1つの文字 → 一覧(空行を除く) */
export function parseLines(text: string): string[] {
	return text.split(/\r?\n/).map((x) => x.trim()).filter((x) => x !== "");
}

/** 1行に1つのフォルダ → 正規化した一覧 */
export function parseFolders(text: string): string[] {
	return folders(parseLines(text));
}

/** 命名規則の行の文字。`フォルダ | 正規表現`、配下も含むときはフォルダの末尾に `/**`、vault 直下は `/` */
export function formatNamingRule(r: NamingRule): string {
	return (r.folder === "" ? (r.includeSubfolders ? "**" : "/") : r.folder + (r.includeSubfolders ? "/**" : "")) + " | " + r.pattern;
}

export function parseNamingRules(text: string): { rules: NamingRule[]; errors: number[] } {
	const rules: NamingRule[] = [];
	const errors: number[] = [];
	parseLines(text).forEach((line, i) => {
		const bar = line.indexOf("|");
		const pattern = bar < 0 ? "" : line.slice(bar + 1).trim();
		if (pattern === "") { errors.push(i + 1); return; }
		let folder = line.slice(0, bar).trim();
		const sub = folder === "**" || folder.endsWith("/**");
		if (sub) folder = folder.slice(0, -2);
		rules.push({ folder: normFolder(folder), pattern, includeSubfolders: sub });
	});
	return { rules, errors };
}

/** 置き場所規則の行の文字。`拡張子 拡張子 | 置いてよいフォルダ | 置いてよいフォルダ` */
export function formatPlacementRule(r: PlacementRule): string {
	return [r.extensions.join(" "), ...r.allowedFolders].join(" | ");
}

export function parsePlacementRules(text: string): { rules: PlacementRule[]; errors: number[] } {
	const rules: PlacementRule[] = [];
	const errors: number[] = [];
	parseLines(text).forEach((line, i) => {
		const [head = "", ...rest] = line.split("|");
		const extensions = exts(head.split(/[\s,]+/));
		const allowedFolders = folders(rest);
		if (!extensions.length || !allowedFolders.length) { errors.push(i + 1); return; }
		rules.push({ extensions, allowedFolders });
	});
	return { rules, errors };
}

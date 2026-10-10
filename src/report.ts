// 結果を Markdown の文字にする(§9.5・FR-14)。クリップボードに入れるのは main.ts(利用者の操作のときだけ)。
// 画面と共有する表示の補い(時刻・リンク切れの小分け・理由の言い換え)もここに置く。obsidian を import しない。
import { isAbsoluteLink } from "./checks/brokenLinks";
import type { RunResult } from "./checks/index";
import { EMPTY_NOTE } from "./checks/residue";
import { countOf, type Shown } from "./ignore";
import { CHECK_IDS, type CheckId, type Finding } from "./model";
import type { Strings } from "./strings";

const pad = (n: number) => String(n).padStart(2, "0");

/** 端末の時刻で "YYYY-MM-DD HH:mm" */
export function formatTime(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** リンク切れを、ふつう・絶対パス(FR-2)・見出しとブロックの欠け(FR-3)に分ける */
export function brokenBuckets(findings: Finding[]): { plain: Finding[]; absolute: Finding[]; subpath: Finding[] } {
	const b = { plain: [] as Finding[], absolute: [] as Finding[], subpath: [] as Finding[] };
	for (const f of findings) {
		if (f.check !== "broken-link") continue;
		if (f.severity === "warning") b.subpath.push(f);
		else if (isAbsoluteLink(f.detail)) b.absolute.push(f);
		else b.plain.push(f);
	}
	return b;
}

/** 理由の文字(0 バイトの md を言語に合わせる) */
export function detailText(f: Finding, S: Strings): string {
	return f.check === "residue" ? f.detail.split(" / ").map((r) => (r === EMPTY_NOTE ? S.emptyNote : r)).join(" / ") : f.detail;
}

/** リンク切れの位置(1 始まりの行、または frontmatter のプロパティ名) */
export function whereText(f: Finding, S: Strings): string {
	if (f.property !== undefined) return S.property(f.property);
	return f.line !== undefined ? S.lineNo(f.line + 1) : "";
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
const row = (cells: string[]) => `| ${cells.map(cell).join(" | ")} |`;

function table(id: CheckId, findings: Finding[], S: Strings): string[] {
	const cols = S.reportCols[id];
	const out = [row(cols), "|" + cols.map(() => "---|").join("")];
	if (id === "duplicate-name") {
		const groups = new Map<string, string[]>();
		for (const f of findings) groups.set(f.detail, [...(groups.get(f.detail) ?? []), f.path]);
		for (const [name, paths] of groups) out.push(row([name, String(paths.length), paths.join("; ")]));
	} else if (id === "broken-link") {
		for (const f of findings) out.push(row([f.path, f.property ?? (f.line !== undefined ? String(f.line + 1) : ""), f.detail]));
	} else if (id === "orphan") {
		for (const f of findings) out.push(row([f.path]));
	} else {
		for (const f of findings) out.push(row([f.path, detailText(f, S)]));
	}
	return out;
}

export function buildReport(r: RunResult, shown: Shown, takenAt: number, S: Strings): string {
	const lines = [
		`# ${S.reportTitle} ${formatTime(takenAt)}`,
		S.meta(r.scanned, r.excluded, shown.ignoredCount),
		"",
		row([S.reportCheck, S.reportCount]),
		"|---|---|",
	];
	for (const id of CHECK_IDS) {
		const n = countOf(shown.findings, id);
		lines.push(row([S.checkName[id], id === "duplicate-name" ? S.groups(n) : String(n)]));
	}
	for (const id of CHECK_IDS) {
		lines.push("", `## ${S.checkName[id]}`);
		const of = shown.findings.filter((f) => f.check === id);
		if (!of.length) { lines.push(S.none); continue; }
		if (id !== "broken-link") { lines.push(...table(id, of, S)); continue; }
		const b = brokenBuckets(of);
		if (b.plain.length) lines.push(...table(id, b.plain, S));
		if (b.absolute.length) lines.push("", `### ${S.absoluteLinks}`, ...table(id, b.absolute, S));
		if (b.subpath.length) lines.push("", `### ${S.subpathLinks}`, ...table(id, b.subpath, S));
	}
	if (r.errors.length) {
		lines.push("", `## ${S.failedChecks}`, ...r.errors.map((e) => `- ${S.checkName[e.check]}: ${e.message}`));
	}
	return lines.join("\n") + "\n";
}

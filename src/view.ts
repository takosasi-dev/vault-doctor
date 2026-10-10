// 右サイドバーのパネル(FR-11)。検査ごとに件数つきで畳める一覧、最終走査時刻と所要ミリ秒、落ちた検査(FR-17)、無効な規則(FR-18)。
// 項目にできるのは「開く」「無視」だけ(INV-4)。要素は createEl 系で作る(INV-6)。データが変わったら plugin が render() を呼ぶ。
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { CHECK_IDS, type Finding } from "./model";
import { countOf } from "./ignore";
import { brokenBuckets, detailText, formatTime, whereText } from "./report";
import { S } from "./strings";
import { parentOf } from "./glob";
import type VaultDoctorPlugin from "./main";

export const VIEW_TYPE = "vault-doctor-panel";

export class VaultDoctorView extends ItemView {
	private expanded = new Map<string, boolean>();   // 開け閉めを描き直しても保つ(open は View の内部の名前なので使わない)

	constructor(leaf: WorkspaceLeaf, private readonly plugin: VaultDoctorPlugin) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return S.panelTitle; }
	getIcon(): string { return "stethoscope"; }

	async onOpen(): Promise<void> {
		this.render();
	}

	render(): void {
		const root = this.contentEl;
		root.empty();
		root.addClass("vd-panel");
		const bar = root.createDiv({ cls: "vd-bar" });
		bar.createEl("button", { text: S.btnRescan }).addEventListener("click", () => this.plugin.scan());
		bar.createEl("button", { text: S.btnCopy }).addEventListener("click", () => void this.plugin.copyReport());

		const st = this.plugin.current();
		if (!st) {
			root.createDiv({ cls: "vd-note", text: S.notScanned });
			return;
		}
		root.createDiv({ cls: "vd-meta", text: S.lastScan(formatTime(st.takenAt), st.ms) });
		root.createDiv({ cls: "vd-meta", text: S.meta(st.result.scanned, st.result.excluded, st.shown.ignoredCount) });
		if (!st.resolvedSeen) root.createDiv({ cls: "vd-note", text: S.indexing });
		// 無効な規則は畳んだ節に隠さず、いつも見える所に出す(FR-18)
		for (const r of st.result.invalid) root.createDiv({ cls: "vd-invalid", text: S.invalidRule(r.rule, r.message) });

		for (const id of CHECK_IDS) {
			const of = st.shown.findings.filter((f) => f.check === id);
			const body = this.section(root, id, S.checkName[id], countOf(of, id));
			if (id === "broken-link") {
				const b = brokenBuckets(of);
				for (const f of b.plain) this.linkRow(body, f);
				if (b.absolute.length) this.subList(body, S.absoluteLinks, b.absolute);
				if (b.subpath.length) this.subList(body, S.subpathLinks, b.subpath);
			} else if (id === "duplicate-name") {
				this.duplicates(body, of);
			} else {
				for (const f of of) this.row(body, f, f.path.split("/").pop() ?? f.path, this.folderText(f.path, detailText(f, S)));
			}
		}

		if (st.result.errors.length) {
			const box = root.createDiv({ cls: "vd-failed" });
			box.createDiv({ cls: "vd-failed-title", text: S.failedChecks });
			for (const e of st.result.errors) box.createDiv({ cls: "vd-invalid", text: `${S.checkName[e.check]}: ${e.message}` });
		}
	}

	/** 件数つきの畳める節。中身を入れる要素を返す */
	private section(root: HTMLElement, id: string, title: string, count: number): HTMLElement {
		const det = root.createEl("details", { cls: "vd-section" });
		det.open = this.expanded.get(id) ?? false;
		det.addEventListener("toggle", () => this.expanded.set(id, det.open));
		const sum = det.createEl("summary");
		sum.createSpan({ text: title });
		sum.createSpan({ cls: "vd-count" + (count ? " vd-count-hit" : ""), text: String(count) });
		return det;
	}

	private subList(body: HTMLElement, title: string, findings: Finding[]): void {
		body.createDiv({ cls: "vd-sub", text: `${title}: ${findings.length}` });
		for (const f of findings) this.linkRow(body, f);
	}

	private linkRow(body: HTMLElement, f: Finding): void {
		const where = whereText(f, S);
		this.row(body, f, f.detail, where ? `${f.path} · ${where}` : f.path);
	}

	private duplicates(body: HTMLElement, findings: Finding[]): void {
		const groups = new Map<string, Finding[]>();
		for (const f of findings) groups.set(f.key, [...(groups.get(f.key) ?? []), f]);
		for (const [key, files] of groups) {
			const head = body.createDiv({ cls: "vd-group" });
			head.createSpan({ cls: "vd-group-name", text: `${files[0]?.path.split("/").pop() ?? ""} (${files.length})` });
			this.ignoreButton(head, key);
			for (const f of files) this.row(body, f, f.path, "", false);
		}
	}

	private folderText(path: string, detail: string): string {
		const folder = parentOf(path) || S.vaultRoot;
		return detail ? `${folder} · ${detail}` : folder;
	}

	private row(body: HTMLElement, f: Finding, main: string, sub: string, ignorable = true): void {
		const r = body.createDiv({ cls: "vd-item", attr: { title: f.path } });
		const text = r.createDiv({ cls: "vd-item-text" });
		text.createDiv({ cls: "vd-item-main", text: main });
		if (sub) text.createDiv({ cls: "vd-item-sub", text: sub });
		r.addEventListener("click", () => void this.plugin.openFinding(f));
		if (ignorable) this.ignoreButton(r, f.key);
	}

	private ignoreButton(parent: HTMLElement, key: string): void {
		const b = parent.createEl("button", { cls: "vd-ignore", text: S.btnIgnore });
		b.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.plugin.ignore(key);
		});
	}
}

// Vault Doctor の入口: パネル・コマンド3つ(§9.3)・設定タブ・走査のきっかけ(onLayoutReady と、間引いた resolved。D-12・FR-13)。
// 走査結果を持ち、無視リストを当てて全部のパネルを描き直す。書き込みは saveData() の data.json だけ(INV-1)。
import { getLanguage, MarkdownView, Notice, Plugin } from "obsidian";
import { runAll, type RunResult } from "./checks/index";
import { applyIgnore, type Shown } from "./ignore";
import type { Finding, VaultSnapshot } from "./model";
import { buildReport } from "./report";
import { normalizeSettings, type Settings } from "./settings";
import { VaultDoctorSettingTab } from "./settings-tab";
import { takeSnapshot } from "./snapshot";
import { S, useLanguage } from "./strings";
import { VaultDoctorView, VIEW_TYPE } from "./view";

export interface Current {
	result: RunResult;
	shown: Shown;
	takenAt: number;
	ms: number;
	resolvedSeen: boolean;
}

export default class VaultDoctorPlugin extends Plugin {
	settings!: Settings;
	private locked = false;                    // data.json を読めなかった・形が違う → 上書きしない(§9.2・§10)
	private snapshot: VaultSnapshot | null = null;
	private result: RunResult | null = null;
	private ms = 0;
	private resolvedSeen = false;
	private timer = 0;

	async onload(): Promise<void> {
		useLanguage(getLanguage());
		await this.loadSettings();
		this.registerView(VIEW_TYPE, (leaf) => new VaultDoctorView(leaf, this));
		this.addCommand({ id: "open-panel", name: S.cmdOpen, callback: () => void this.openPanel() });
		this.addCommand({ id: "rescan", name: S.cmdRescan, callback: () => this.scan() });
		this.addCommand({ id: "copy-report", name: S.cmdCopy, callback: () => void this.copyReport() });
		this.addSettingTab(new VaultDoctorSettingTab(this.app, this));

		// resolved はファイルが変わるたびに来る。最後の1回から待って1回だけ走査する(D-12)。
		// 初めての resolved は、起動直後の索引作りが終わった合図かもしれないので、自動が切れていても走査し直す(§10)
		this.registerEvent(this.app.metadataCache.on("resolved", () => {
			const first = !this.resolvedSeen;
			this.resolvedSeen = true;
			if (!first && !this.settings.autoRefresh) return;
			window.clearTimeout(this.timer);
			this.timer = window.setTimeout(() => this.scan(), this.settings.autoRefreshDelayMs);
		}));
		this.register(() => window.clearTimeout(this.timer));
		this.app.workspace.onLayoutReady(() => this.scan());
	}

	async loadSettings(): Promise<void> {
		let raw: unknown = null;
		let broken = false;
		try {
			raw = await this.loadData();
		} catch {
			broken = true;
		}
		const { settings, problem } = normalizeSettings(raw);
		this.settings = settings;
		if (broken || problem) {
			this.locked = true;
			new Notice(problem === "schema" ? S.noticeSchema : S.noticeBroken);
		}
	}

	/** 保存して、今のスナップショットで検査をやり直す(設定は検査にだけ効く) */
	async saveSettings(): Promise<void> {
		if (this.locked) new Notice(S.noticeNotSaved);
		else await this.saveData(this.settings);
		if (this.snapshot) this.result = runAll(this.snapshot, this.settings);
		this.refreshViews();
	}

	/** 走査は同期で終わる(メタデータキャッシュを読むだけ)ので、走査の途中に次のきっかけが割り込むことは無い */
	scan(): void {
		const t0 = performance.now();
		this.snapshot = takeSnapshot(this.app, this.resolvedSeen);
		this.result = runAll(this.snapshot, this.settings);
		this.ms = Math.round(performance.now() - t0);
		this.refreshViews();
	}

	current(): Current | null {
		if (!this.snapshot || !this.result) return null;
		return {
			result: this.result,
			shown: applyIgnore(this.result.findings, this.settings.ignored),
			takenAt: this.snapshot.takenAt,
			ms: this.ms,
			resolvedSeen: this.snapshot.resolvedSeen,
		};
	}

	async ignore(key: string): Promise<void> {
		if (!this.settings.ignored.includes(key)) this.settings.ignored.push(key);
		await this.saveSettings();
	}

	async openPanel(): Promise<void> {
		await this.app.workspace.ensureSideLeaf(VIEW_TYPE, "right", { active: true, reveal: true });
	}

	/** パネルへの参照は持たず、開いている物を全部描き直す(§10) */
	private refreshViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			if (leaf.view instanceof VaultDoctorView) leaf.view.render();
		}
	}

	/** 項目のファイルを開く。リンク切れは該当行へカーソルを置く(FR-15。d.ts にある Editor の setCursor と scrollIntoView で) */
	async openFinding(f: Finding): Promise<void> {
		const file = this.app.vault.getFileByPath(f.path);
		if (!file) {
			new Notice(S.noticeMissing(f.path));
			return;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		if (f.line !== undefined && leaf.view instanceof MarkdownView) {
			const pos = { line: f.line, ch: 0 };
			leaf.view.editor.setCursor(pos);
			leaf.view.editor.scrollIntoView({ from: pos, to: pos }, true);
		}
	}

	/** レポートをクリップボードへ(FR-14。コマンドかボタンを押したときだけ) */
	async copyReport(): Promise<void> {
		if (!this.result) this.scan();
		const cur = this.current();
		if (!cur) return;
		try {
			await navigator.clipboard.writeText(buildReport(cur.result, cur.shown, cur.takenAt, S));
			new Notice(S.noticeCopied);
		} catch (e) {
			new Notice(S.noticeCopyFailed(e instanceof Error ? e.message : String(e)));
		}
	}
}

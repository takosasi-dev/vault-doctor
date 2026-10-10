// 設定画面(getSettingDefinitions、1.13.0 以降。D-9)。一覧と規則は1行に1つの文字で見せ、保存は Plugin.saveData() だけ(INV-1)。
// 無視リストの全解除(FR-10)は確認の窓を出してから行う。
import { App, ConfirmationModal, normalizePath, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import {
	formatNamingRule, formatPlacementRule, parseLines, parseNamingRules, parsePlacementRules, type Settings,
} from "./settings";
import { S } from "./strings";
import type VaultDoctorPlugin from "./main";

const FOLDER_KEYS = new Set(["excludeFolders", "orphanExemptFolders"]);
const NAME_KEYS = new Set(["duplicateAllowedNames", "residuePatterns"]);

export class VaultDoctorSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly owner: VaultDoctorPlugin) {
		super(app, owner);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const shown = this.owner.current()?.shown;
		const lineCheck = (parse: (t: string) => { errors: number[] }) =>
			(v: string) => { const { errors } = parse(v); return errors.length ? S.errLines(errors) : undefined; };
		return [
			{ type: "group", items: [                    // 最初の組は見出し無し(Plugin guidelines)
				{ name: S.setExclude, desc: S.setExcludeDesc, control: { type: "textarea", key: "excludeFolders", rows: 3 } },
				{ name: S.setExempt, desc: S.setExemptDesc, control: { type: "textarea", key: "orphanExemptFolders", rows: 3 } },
				{ name: S.setDupAllowed, desc: S.setDupAllowedDesc, control: { type: "textarea", key: "duplicateAllowedNames", rows: 3 } },
				{ name: S.setResidue, desc: S.setResidueDesc, control: { type: "textarea", key: "residuePatterns", rows: 3 } },
				{ name: S.setEmptyNote, desc: S.setEmptyNoteDesc, control: { type: "toggle", key: "emptyNoteIsResidue" } },
				{ name: S.setSubpaths, desc: S.setSubpathsDesc, control: { type: "toggle", key: "checkSubpaths" } },
			] },
			{ type: "group", heading: S.setHeadingRules, items: [
				{ name: S.setNaming, desc: S.setNamingDesc,
					control: { type: "textarea", key: "namingRules", rows: 4, validate: lineCheck(parseNamingRules) } },
				{ name: S.setPlacement, desc: S.setPlacementDesc,
					control: { type: "textarea", key: "placementRules", rows: 4, validate: lineCheck(parsePlacementRules) } },
			] },
			{ type: "group", heading: S.setHeadingAuto, items: [
				{ name: S.setAuto, desc: S.setAutoDesc, control: { type: "toggle", key: "autoRefresh" } },
				{ name: S.setDelay, desc: S.setDelayDesc, control: { type: "number", key: "autoRefreshDelayMs", min: 0, step: 100 } },
			] },
			{ type: "group", heading: S.setHeadingIgnored, items: [
				{ name: S.setClear, desc: S.setClearDesc(this.owner.settings.ignored.length, shown?.staleIgnores ?? 0),
					disabled: () => this.owner.settings.ignored.length === 0,
					action: () => this.confirmClear() },
			] },
		];
	}

	/** 一覧と規則は1行に1つの文字にして見せる */
	getControlValue(key: string): unknown {
		const s = this.owner.settings;
		if (key === "namingRules") return s.namingRules.map(formatNamingRule).join("\n");
		if (key === "placementRules") return s.placementRules.map(formatPlacementRule).join("\n");
		if (FOLDER_KEYS.has(key) || NAME_KEYS.has(key)) return (s[key as keyof Settings] as string[]).join("\n");
		return s[key as keyof Settings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.owner.settings as unknown as Record<string, unknown>;
		const text = String(value);
		if (key === "namingRules") {
			s[key] = parseNamingRules(text).rules;
		} else if (key === "placementRules") {
			s[key] = parsePlacementRules(text).rules.map((r) => ({ ...r, allowedFolders: r.allowedFolders.map(normalizePath) }));
		} else if (FOLDER_KEYS.has(key)) {
			s[key] = parseLines(text).map(normalizePath).filter((f) => f !== "/");
		} else if (NAME_KEYS.has(key)) {
			s[key] = parseLines(text);
		} else if (key === "autoRefreshDelayMs") {
			const n = Number(value);
			if (Number.isInteger(n) && n >= 0) s[key] = n;
		} else {
			s[key] = value;
		}
		await this.owner.saveSettings();
	}

	private confirmClear(): void {
		const n = this.owner.settings.ignored.length;
		new ConfirmationModal(this.app)
			.setTitle(S.setClear)
			.setContent(S.confirmClear(n))
			.addButton((b) => b.setButtonText(S.btnClear).setDestructive().onClick(async () => {
				this.owner.settings.ignored = [];
				await this.owner.saveSettings();
				this.update();
			}))
			.addCancelButton()
			.open();
	}
}

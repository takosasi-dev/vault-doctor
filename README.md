# Vault Doctor

Find broken links, orphan notes, and files that break your own folder naming and placement rules. Read-only.

Vault Doctor shows a health panel in the right sidebar. It never changes your notes: you can open an item or ignore it, and that is all. The only file it writes is its own settings file. It makes no network requests and works on desktop and mobile.

**Screen language:** English. If Obsidian's display language is Japanese, the commands, the panel, the settings, and the copied report are in Japanese. This README uses the English text.

*日本語の要約は末尾にあります。*

## What it checks

| Check | What is listed |
|---|---|
| Broken links | Links, embeds, and property links that Obsidian cannot resolve, with the source note and line (or property name). Links that start with a drive letter (`C:/`, `D:\`) or `file:///` are listed separately, because they break on other devices. Optionally, links to a heading or block that does not exist (warning). |
| Orphan notes | Markdown notes that no other file links to. You can exempt folders, for example a daily notes folder. |
| Duplicate names | Files with the same name (with extension, ignoring case and Unicode normalization) in different folders. You can allow names by pattern, for example `????-??-??.md`. |
| Naming rules | Your own rules: "files in this folder must match this regular expression". |
| Leftover files | Files whose names match a pattern (default: `Untitled*` and `無題のファイル*`, the Japanese default name) and 0-byte notes. |
| Placement rules | Your own rules: "files with these extensions belong only in these folders". |

Link checks use Obsidian's own link resolution, so a link is reported as broken exactly when clicking it in Obsidian would not find a file.

## Is it for your vault?

It works with any vault and expects nothing about how your notes are written. Nothing in the defaults is specific to one vault.

Broken links, orphan notes, duplicate names, and leftover files are listed as soon as the plugin is enabled. **Naming rules and placement rules start empty**, so those two checks list nothing until you write rules for your own folders in the settings, for example:

```
Daily | ^\d{4}-\d{2}-\d{2}\.md$
Projects/** | ^[a-z0-9-]+\.md$
```

```
pdf png | Attachments
```

## Installation

Requires Obsidian 1.14.4 or later. Not yet in the community plugin directory.

### With BRAT (recommended)

1. Install and enable the community plugin "BRAT" (Obsidian42 - BRAT).
2. In the BRAT settings, choose "Add Beta plugin" and enter `takosasi-dev/vault-doctor`.
3. Enable "Vault Doctor" in the list of community plugins.

### Manual

Download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/takosasi-dev/vault-doctor/releases), put them in `<vault>/.obsidian/plugins/vault-doctor/`, and enable the plugin in the list of community plugins.

## Usage

### Commands

| Name in the command palette (Japanese display) | What it does |
|---|---|
| `Vault Doctor: Open vault health panel` (`健康診断のパネルを開く`) | Opens the panel in the right sidebar. |
| `Vault Doctor: Rescan vault` (`vault を走査し直す`) | Scans again and redraws the panel. |
| `Vault Doctor: Copy vault health report` (`健康診断のレポートをコピー`) | Copies the results to the clipboard as Markdown tables. |

No default hotkeys are set.

### What you see

- At the top of the panel (`Vault health`): the buttons **Rescan** and **Copy report**, then `Last scan: 2026-01-15 09:30 (12 ms)` and `Files scanned: N / Excluded: N / Ignored: N`.
- Below, one collapsed section per check, with its count on the right. Click a section to open it.
- Click an item to open the file. For broken links, the cursor moves to the line.
- Click **Ignore** to hide an item. Duplicate names are ignored as a group. Settings → Ignored items → Clear ignored items brings everything back.
- Inside Broken links, two sub-lists appear when they have items: `Absolute path links (they break on other devices)` and `Missing headings or blocks (warning)`.
- A rule whose regular expression is not valid is shown above the sections as `Invalid rule: …`. The other rules and checks still run. If a check fails, it is named under `Failed checks` at the bottom, and the other checks are still listed.
- The panel rescans after Obsidian updates its link index (you can turn this off or change the delay). Right after startup it may say `Obsidian may still be indexing links. The panel rescans when indexing finishes.`

## Settings

Lists are one entry per line. Folders are relative to the vault root; `Foo` covers `Foo/` but not `FooBar/`.

| Item | Default | What it does |
|---|---|---|
| Excluded folders | empty | Ignored by every check. |
| Folders exempt from the orphan check | empty | Notes in these folders are never listed as orphans. |
| Names allowed to repeat | empty | Patterns for names that may exist in several folders. |
| Leftover file patterns | `Untitled*`, `無題のファイル*` | Patterns matched against the file name. |
| List empty notes as leftovers | ON | Lists Markdown files of 0 bytes. |
| Check headings and blocks | OFF | Warns when a link points to a heading or block that does not exist. |
| Naming rules | empty | One rule per line: `folder \| regular expression`. |
| Placement rules | empty | One rule per line: `extensions \| allowed folder \| allowed folder`. |
| Rescan automatically | ON | Rescans after Obsidian updates its link index. |
| Delay in milliseconds | 5000 | Waits this long after the last change, then rescans once. |
| Clear ignored items | — | Shows how many items are ignored and how many of them match nothing now. Asks before clearing. |

- **Naming rules**: the expression is tested against the file name with its extension, for example `Daily | ^\d{4}-\d{2}-\d{2}\.md$`. It is a partial match, so use `^` and `$` to match the whole name. End the folder with `/**` to include subfolders; use `/` for the vault root.
- **Placement rules**: separate extensions with spaces, for example `pdf png | Attachments`. If several rules name the same extension, a file is fine when any one of them allows its folder.
- Patterns for duplicate names and leftovers support only `*` and `?`, case-insensitive.

## Disclosures

- **Network**: none. The plugin makes no network requests and has no telemetry, ads, or account.
- **Files outside the vault**: never read or written.
- **Files inside the vault**: never created, changed, moved, renamed, or deleted. Note contents are never opened; the plugin uses only Obsidian's file list, its metadata cache, and file sizes. The only file it writes is its own settings file (`data.json` in the plugin folder), which holds your settings and your ignore list. If that file cannot be read or was written by another version, the plugin runs with the defaults, says so, and does not overwrite it.
- **Clipboard**: written only when you run **Copy vault health report** or press **Copy report**.
- No Node.js or Electron APIs are used, so the plugin also runs on mobile.

## Status

- Version 0.1.0. Tested on Obsidian 1.14.4 on Windows: the scan, the panel (with findings for broken links, orphan notes, duplicate names, and leftover files; the naming and placement rules were left empty), opening an item at its line in editing view, and the settings screen.
- Not tested on a real iPhone or Android device. In Obsidian's mobile emulation the plugin loads and its screens are displayed.
- Not confirmed yet: writing the report to the real system clipboard, and moving to the line when the note opens in reading view.
- Scan time on a phone has not been measured. If automatic rescans feel slow there, turn off **Rescan automatically**.

## Known limitations

- Files and folders whose names start with a dot are not visible to plugins and are never checked.
- Whether links from Canvas files and Bases files count as incoming links has not been confirmed. A note linked only from a canvas or a base may be listed as an orphan.
- Whether files hidden by Obsidian's "Detect all file extensions" setting are visible has not been confirmed. Placement rules can only check files that Obsidian lists.
- Obsidian's own "Excluded files" setting is not read. Use the plugin's excluded folders instead.
- Links from notes in an excluded folder still count as incoming links. A note linked only from an excluded folder is not listed as an orphan.
- "Empty" means 0 bytes. A note with only properties is not empty, because note contents are never read.
- Right after Obsidian starts, or while a sync is writing files, results can change between scans. The panel says so when the link index may still be building.
- On iOS older than 16.4, regular expressions with lookbehind are invalid and such rules are shown as invalid.

## Development

```
npm install
npm run build        # type-check, then bundle main.js
npm test             # vitest
npm run lint         # eslint-plugin-obsidianmd
```

The checks are plain functions that do not import `obsidian`, and the tests use synthetic vault snapshots only.

## License

MIT. See [LICENSE](LICENSE).

---

## 日本語の要約

**Vault Doctor** は、vault の「あとで困る物」を右サイドバーのパネルに件数つきで並べる Obsidian プラグインです。

- 調べるのは 6 種: リンク切れ・孤立ノート・重複ファイル名・命名規則違反・残骸(`Untitled*` などの名前と 0 バイトのノート)・置き場所規則違反
- 読むだけ。ノートの作成・変更・移動・名前の変更・削除はしない。本文も開かない。書くのは自分の設定ファイル(`data.json`。無視した項目もここ)だけ
- 項目にできるのは「開く」(リンク切れはその行へ)と「無視」だけ。結果は Markdown の表にしてクリップボードへコピーできる
- 命名規則と置き場所規則は既定が空。自分のフォルダの決まりを設定に書くまで、この 2 つは 0 件のまま
- ネットワークに出ない。Node.js / Electron の機能を使わないので、モバイルでも動く作り
- 画面は英語が基本で、Obsidian の表示言語が日本語なら日本語になる(コマンドは `健康診断のパネルを開く`・`vault を走査し直す`・`健康診断のレポートをコピー`)
- 入れ方: BRAT に `takosasi-dev/vault-doctor` を入れる。Obsidian 1.14.4 以降
- 確認したのは Windows の Obsidian 1.14.4。iPhone・Android の実機は未確認(モバイル表示のエミュレーションで読み込みと表示まで確認)

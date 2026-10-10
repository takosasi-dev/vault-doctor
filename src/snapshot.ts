// Obsidian の API を「読む」のはこのファイルだけ(§2)。ファイル一覧・メタデータキャッシュのリンク・Obsidian のリンク解決を写し取る。
// ノートの本文は開かない(INV-8)。使うのは getFiles・getFileCache・getFirstLinkpathDest・resolveSubpath・resolvedLinks と TFile.stat だけ。
import { getLinkpath, parseLinktext, resolveSubpath, type App } from "obsidian";
import type { SnapLink, VaultSnapshot } from "./model";

export function takeSnapshot(app: App, resolvedSeen: boolean): VaultSnapshot {
	const { vault, metadataCache: mc } = app;
	const files = vault.getFiles().map((f) => ({ path: f.path, name: f.name, ext: f.extension, size: f.stat.size, mtime: f.stat.mtime }));
	const links: SnapLink[] = [];
	for (const src of vault.getMarkdownFiles()) {
		const cache = mc.getFileCache(src);
		if (!cache) continue;
		const add = (link: string, line?: number, property?: string) => {
			const linkpath = getLinkpath(link);
			const { subpath } = parseLinktext(link);
			const dest = linkpath === "" ? src : mc.getFirstLinkpathDest(linkpath, src.path);   // [[#見出し]] は自分
			let subpathFound: boolean | null = null;
			if (dest && subpath && dest.extension === "md") {
				const destCache = mc.getFileCache(dest);
				if (destCache) subpathFound = resolveSubpath(destCache, subpath) !== null;
			}
			links.push({ source: src.path, link, linkpath, subpath, line, property, dest: dest?.path ?? null, subpathFound });
		};
		for (const l of cache.links ?? []) add(l.link, l.position.start.line);
		for (const l of cache.embeds ?? []) add(l.link, l.position.start.line);
		for (const l of cache.frontmatterLinks ?? []) add(l.link, undefined, l.key);
	}
	const incoming: Record<string, number> = {};
	for (const [source, dests] of Object.entries(mc.resolvedLinks)) {
		for (const target of Object.keys(dests)) if (target !== source) incoming[target] = (incoming[target] ?? 0) + 1;
	}
	return { files, links, incoming, takenAt: Date.now(), resolvedSeen };
}

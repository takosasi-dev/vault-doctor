// 名前とフォルダの当てはめ: `*` `?` だけのワイルドカード(FR-5・FR-7)、フォルダの正規化と配下の判定(§9.2)。
// 比べる前に NFC にそろえる(D-13)。obsidian を import しない。
export const nfc = (s: string): string => s.normalize("NFC");

/** `*` と `?` だけのワイルドカードを、名前全体に当てる大文字小文字を区別しない正規表現にする */
export function globToRegExp(pattern: string): RegExp {
	let src = "";
	for (const ch of nfc(pattern)) {
		if (ch === "*") src += ".*";
		else if (ch === "?") src += ".";
		else src += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp("^" + src + "$", "iu");
}

/** vault からの相対フォルダにそろえる(区切りは /、前後の / なし、NFC)。"" と "/" は vault 全体 */
export function normFolder(folder: string): string {
	return nfc(folder.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, ""));
}

/** path が folder(normFolder 済み)の配下か。Foo は Foo/ の配下だけ(FooBar/ は外) */
export function inFolder(path: string, folder: string): boolean {
	return folder === "" || nfc(path).startsWith(folder + "/");
}

/** 親フォルダ(vault 直下なら "")。NFC で返す */
export function parentOf(path: string): string {
	const p = nfc(path);
	const i = p.lastIndexOf("/");
	return i < 0 ? "" : p.slice(0, i);
}

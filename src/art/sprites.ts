import type Phaser from "phaser";

/**
 * 工房のドット絵（14x14 = 盤面 1 マス）と小アイコン。開発チーム（rio）の自作（CREDITS.md 参照）。
 * 文字 = 色の対応は PALETTE。"." は透明。向きは盤面側の矢印で示すので、絵は向きを持たない。
 * 絵は文字列で持ち、canvas に点を打って作る（画像ファイルなし）。
 */
export const PALETTE: Readonly<Record<string, string>> = {
  // 共通
  d: "#140f18", // 最暗（影・輪郭）
  f: "#1e1722", // 床
  g: "#2a2030", // 床の点
  // ベルト（紫）
  p: "#5c4a66",
  P: "#7a6486",
  // 合流機（青灰）
  b: "#4a5c66",
  B: "#7f98a6",
  // 仕分け機（茶）
  r: "#66584a",
  R: "#a38d72",
  // 調律機（緑）
  n: "#4a6652",
  N: "#86b592",
  // 回収箱（灰）
  s: "#3a3a46",
  S: "#6c6c7c",
  // 入口（ミント）/ 出口（ピンク）/ 琥珀 / 白
  m: "#8fd6c8",
  k: "#f28f9a",
  a: "#f2b45a",
  w: "#f3e9dc",
  x: "#ff6b5e",
};

export type SpriteName =
  | "floor"
  | "blocked"
  | "belt"
  | "merger"
  | "sorter"
  | "tuner"
  | "bin"
  | "speaker-on"
  | "speaker-off"
  | "lock"
  | "note-on"
  | "note-off";

/** 盤面のマスの大きさ（WorkshopScene.CELL と同じ）。 */
export const TILE = 14;

export const SPRITES: Readonly<Record<SpriteName, readonly string[]>> = {
  floor: [
    "ffffffffffffff",
    "ffffffffffffff",
    "ffffffffffffff",
    "fffffgfffffgff",
    "ffffffffffffff",
    "ffffffffffffff",
    "ffgfffffgfffff",
    "ffffffffffffff",
    "ffffffffffffff",
    "fffffgfffffgff",
    "ffffffffffffff",
    "ffffffffffffff",
    "ffgfffffgfffff",
    "ffffffffffffff",
  ],
  blocked: [
    "dddddddddddddd",
    "dsdsdsdsdsdsds",
    "dsdsdsdsdsdsds",
    "dddddddddddddd",
    "dsdsdsdsdsdsds",
    "dsdsdsdsdsdsds",
    "dddddddddddddd",
    "dsdsdsdsdsdsds",
    "dsdsdsdsdsdsds",
    "dddddddddddddd",
    "dsdsdsdsdsdsds",
    "dsdsdsdsdsdsds",
    "dddddddddddddd",
    "dddddddddddddd",
  ],
  // ベルト: 上下のレールとローラー
  belt: [
    "..............",
    "dddddddddddddd",
    "dPPPPPPPPPPPPd",
    "dppppppppppppd",
    "dpdppdppdppdpd",
    "dpPppPppPppPpd",
    "dpdppdppdppdpd",
    "dpPppPppPppPpd",
    "dpdppdppdppdpd",
    "dppppppppppppd",
    "dPPPPPPPPPPPPd",
    "dddddddddddddd",
    "..............",
    "..............",
  ],
  // 合流機: 2 本が 1 本に合わさる Y 字
  merger: [
    "dddddddddddddd",
    "dBBBBBBBBBBBBd",
    "dbbbbbbbbbbbbd",
    "dbBBbbbbbbBBbd",
    "dbbBBbbbbBBbbd",
    "dbbbBBbbBBbbbd",
    "dbbbbBBBBbbbbd",
    "dbbbbbBBbbbbbd",
    "dbbbbbBBbbbbbd",
    "dbbbbbBBbbbbbd",
    "dbbbbbBBbbbbbd",
    "dbbbbbbbbbbbbd",
    "dBBBBBBBBBBBBd",
    "dddddddddddddd",
  ],
  // 仕分け機: 箱＋ランプ（右下は音高の点を盤面側が重ねる）
  sorter: [
    "dddddddddddddd",
    "dRRRRRRRRRRRRd",
    "drrrrrrrrrrrrd",
    "drrdddddddrrrd",
    "drrdaaaaadrrrd",
    "drrdaaaaadrrrd",
    "drrdddddddrrrd",
    "drrrrrrrrrrrrd",
    "drrRRrrrrRRrrd",
    "drrRRrrrrRRrrd",
    "drrrrrrrrrrrrd",
    "dRRRRRRRRRRRRd",
    "dddddddddddddd",
    "..............",
  ],
  // 調律機: 音叉
  tuner: [
    "dddddddddddddd",
    "dNNNNNNNNNNNNd",
    "dnnnnnnnnnnnnd",
    "dnnNnnnnnnNnnd",
    "dnnNnnnnnnNnnd",
    "dnnNnnnnnnNnnd",
    "dnnNNNNNNNNnnd",
    "dnnnnnNNnnnnnd",
    "dnnnnnNNnnnnnd",
    "dnnnnnNNnnnnnd",
    "dnnnnnNNnnnnnd",
    "dnnnnNNNNnnnnd",
    "dNNNNNNNNNNNNd",
    "dddddddddddddd",
  ],
  // 回収箱: 口の開いた箱
  bin: [
    "dddddddddddddd",
    "dSSSSSSSSSSSSd",
    "dSssssssssssSd",
    "dSsddddddddsSd",
    "dSsddddddddsSd",
    "dSsddddddddsSd",
    "dSsddddddddsSd",
    "dSsddddddddsSd",
    "dSsddddddddsSd",
    "dSsddddddddsSd",
    "dSssssssssssSd",
    "dSSSSSSSSSSSSd",
    "dddddddddddddd",
    "..............",
  ],
  // 小アイコン（12x12）。音量・鍵
  "speaker-on": [
    "............",
    "....w.......",
    "...ww..w....",
    "wwwww...w...",
    "wwwww.w.w...",
    "wwwww..w.w..",
    "wwwww..w.w..",
    "wwwww.w.w...",
    "wwwww...w...",
    "...ww..w....",
    "....w.......",
    "............",
  ],
  "speaker-off": [
    "............",
    "....w.......",
    "...ww.......",
    "wwwww.x...x.",
    "wwwww..x.x..",
    "wwwww...x...",
    "wwwww...x...",
    "wwwww..x.x..",
    "wwwww.x...x.",
    "...ww.......",
    "....w.......",
    "............",
  ],
  // 音符アイコン（音のオン/オフ。♪ボタン用）
  "note-on": [
    "............",
    "......wwww..",
    "......wwww..",
    "......w..w..",
    "......w..w..",
    "......w..w..",
    "......w.ww..",
    "...www.www..",
    "..wwww......",
    "..www.......",
    "............",
    "............",
  ],
  "note-off": [
    "............",
    "......wwww..",
    "......wwww..",
    "x.....w..w.x",
    ".x....w.x.x.",
    "..x...w.x...",
    "...x..w.x...",
    "...wxw.x.w..",
    "..wwxxx.....",
    "..www.x.x...",
    "...........x",
    "............",
  ],
  lock: [
    "............",
    "....aaaa....",
    "...aa..aa...",
    "...a....a...",
    "...a....a...",
    "..wwwwwwww..",
    "..wwwwwwww..",
    "..wwwddwww..",
    "..wwwddwww..",
    "..wwwwwwww..",
    "..wwwwwwww..",
    "............",
  ],
};

/** 3x5 の小さな文字（入口・出口のラベル用）。使う文字だけ。 */
const GLYPH: Readonly<Record<string, readonly string[]>> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  L: ["100", "100", "100", "100", "111"],
  O: ["111", "101", "101", "101", "111"],
  P: ["110", "101", "110", "100", "100"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
};

/** ラベル文字列（例 "OUT"）を点の座標にする。幅は 4*n-1。 */
export function labelDots(text: string): { w: number; h: number; dots: [number, number][] } {
  const chars = [...text.toUpperCase()];
  const dots: [number, number][] = [];
  chars.forEach((ch, i) => {
    (GLYPH[ch] ?? GLYPH.I ?? []).forEach((row, y) => {
      [...row].forEach((v, x) => {
        if (v === "1") dots.push([i * 4 + x, y]);
      });
    });
  });
  return { w: Math.max(0, chars.length * 4 - 1), h: 5, dots };
}

function drawRows(ctx: CanvasRenderingContext2D, rows: readonly string[]): void {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = PALETTE[ch];
      if (!c) return;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    });
  });
}

/** 入口/出口のマス。地色（ミント/ピンク）の上にラベルを暗色で重ねる。 */
export function drawPort(
  ctx: CanvasRenderingContext2D,
  kind: "input" | "output",
  label: string,
): void {
  ctx.fillStyle = "#140f18";
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = kind === "input" ? "#8fd6c8" : "#f28f9a";
  ctx.fillRect(1, 1, TILE - 2, TILE - 2);
  const { w, dots } = labelDots(label);
  // 上半分に置く（下半分は盤面側の向き矢印が入る）
  const ox = Math.floor((TILE - w) / 2);
  ctx.fillStyle = "#140f18";
  for (const [x, y] of dots) ctx.fillRect(ox + x, 1 + y, 1, 1);
}

/** Phaser 用: 全スプライトのテクスチャを登録（既にあれば何もしない）。 */
export function registerTextures(textures: Phaser.Textures.TextureManager): void {
  for (const name of Object.keys(SPRITES) as SpriteName[]) {
    const rows = SPRITES[name];
    const key = `ae-${name}`;
    if (textures.exists(key)) continue;
    const tex = textures.createCanvas(key, rows[0]?.length ?? TILE, rows.length);
    if (!tex) continue;
    drawRows(tex.getContext(), rows);
    tex.refresh();
  }
}

/** Phaser 用: 入口/出口ラベル付きテクスチャのキーを返す（なければ作る）。 */
export function portTexture(
  textures: Phaser.Textures.TextureManager,
  kind: "input" | "output",
  label: string,
): string {
  const key = `ae-port-${kind}-${label}`;
  if (textures.exists(key)) return key;
  const tex = textures.createCanvas(key, TILE, TILE);
  if (tex) {
    drawPort(tex.getContext(), kind, label);
    tex.refresh();
  }
  return key;
}

/** DOM 用: 小アイコンの <canvas>（CSS で拡大。image-rendering: pixelated）。 */
export function iconCanvas(name: SpriteName, className = "ae-icon"): HTMLCanvasElement {
  const rows = SPRITES[name];
  const c = document.createElement("canvas");
  c.width = rows[0]?.length ?? TILE;
  c.height = rows.length;
  c.className = className;
  c.setAttribute("aria-hidden", "true");
  const ctx = c.getContext("2d");
  if (ctx) drawRows(ctx, rows);
  return c;
}

/** 音符（長さ1=大 / 2以上=小）。c=音高色 h=ハイライト d=輪郭。10x10。 */
const NOTE_ROWS: Readonly<Record<"short" | "long", readonly string[]>> = {
  short: [
    "..dddddd..",
    ".dccccccd.",
    "dcchhccccd",
    "dchhcccccd",
    "dcccccccdd",
    "dcccccccdd",
    "dccccccdd.",
    ".dccccccd.",
    "..dddddd..",
    "..........",
  ],
  long: [
    "..........",
    "...dddd...",
    "..dcchcd..",
    ".dcchccdd.",
    ".dcccccdd.",
    ".dcccccdd.",
    "..dcccdd..",
    "...dddd...",
    "..........",
    "..........",
  ],
};
export const NOTE_SIZE = 10;

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function drawNote(
  ctx: CanvasRenderingContext2D,
  length: "short" | "long",
  color: number,
): void {
  NOTE_ROWS[length].forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") return;
      ctx.fillStyle = ch === "d" ? "#140f18" : ch === "h" ? "#ffffff" : hex(color);
      ctx.fillRect(x, y, 1, 1);
    });
  });
}

/** 音符テクスチャのキー（なければ作る）。 */
export function noteTexture(
  textures: Phaser.Textures.TextureManager,
  length: "short" | "long",
  color: number,
): string {
  const key = `ae-note-${length}-${color.toString(16)}`;
  if (textures.exists(key)) return key;
  const tex = textures.createCanvas(key, NOTE_SIZE, NOTE_SIZE);
  if (tex) {
    drawNote(tex.getContext(), length, color);
    tex.refresh();
  }
  return key;
}

/** 稼働ランプ付きの機械テクスチャ。frame 0/1 で左上/右上のランプが交互に灯る（2フレーム）。 */
export function activeTexture(
  textures: Phaser.Textures.TextureManager,
  machine: SpriteName,
  frame: 0 | 1,
): string {
  const key = `ae-${machine}-on${frame}`;
  if (textures.exists(key)) return key;
  const rows = SPRITES[machine];
  const tex = textures.createCanvas(key, rows[0]?.length ?? TILE, rows.length);
  if (tex) {
    const ctx = tex.getContext();
    drawRows(ctx, rows);
    const lamp = (x: number, lit: boolean) => {
      ctx.fillStyle = "#140f18";
      ctx.fillRect(x - 1, 1, 4, 4);
      ctx.fillStyle = lit ? PALETTE.a ?? "#f2b45a" : "#3a2f40";
      ctx.fillRect(x, 2, 2, 2);
    };
    lamp(1, frame === 0);
    lamp(TILE - 3, frame === 1);
    tex.refresh();
  }
  return key;
}

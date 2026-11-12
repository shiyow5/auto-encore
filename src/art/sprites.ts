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
  // メダル（金/銀/銅）: 1=本体 2=ハイライト 3=影
  "1": "#f2b45a",
  "2": "#fff1c2",
  "3": "#b7762a",
  "4": "#c9cfdc",
  "5": "#f4f6fb",
  "6": "#7d8497",
  "7": "#d98f5f",
  "8": "#f2c19c",
  "9": "#8f5430",
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
  | "medal-gold"
  | "medal-silver"
  | "medal-bronze"
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
  "medal-gold": [
    "...dddddd...",
    "..d111111d..",
    ".d12211113d.",
    ".d12111113d.",
    "d1111111113d",
    "d1111111113d",
    "d1111111113d",
    "d1111111113d",
    ".d11111113d.",
    ".d11111133d.",
    "..d333333d..",
    "...dddddd...",
  ],
  "medal-silver": [
    "...dddddd...",
    "..d444444d..",
    ".d45544446d.",
    ".d45444446d.",
    "d4444444446d",
    "d4444444446d",
    "d4444444446d",
    "d4444444446d",
    ".d44444446d.",
    ".d44444466d.",
    "..d666666d..",
    "...dddddd...",
  ],
  "medal-bronze": [
    "...dddddd...",
    "..d777777d..",
    ".d78877779d.",
    ".d78777779d.",
    "d7777777779d",
    "d7777777779d",
    "d7777777779d",
    "d7777777779d",
    ".d77777779d.",
    ".d77777799d.",
    "..d999999d..",
    "...dddddd...",
  ],
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

/** 入口/出口のマス。地色（ミント=入口/ピンク=出口）の1px明暗の縁だけ。文字は右パネルの注文票に出す（#112 方針c）。 */
export function drawPort(ctx: CanvasRenderingContext2D, kind: "input" | "output"): void {
  ctx.fillStyle = "#140f18";
  ctx.fillRect(0, 0, TILE, TILE);
  const base = kind === "input" ? "#8fd6c8" : "#f28f9a";
  const light = kind === "input" ? "#c4efe6" : "#f9c3c9";
  const shade = kind === "input" ? "#5fae9f" : "#c8606d";
  // 平らな塗りではなく、1pxの明/暗の縁で段差をつけたドット絵のパネルにする
  for (let y = 1; y < TILE - 1; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      const top = y === 1 || x === 1;
      const bottom = y === TILE - 2 || x === TILE - 2;
      ctx.fillStyle = top && !bottom ? light : bottom ? shade : base;
      ctx.fillRect(x, y, 1, 1);
    }
  }
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

/** Phaser 用: 入口/出口のテクスチャのキーを返す（なければ作る）。 */
export function portTexture(
  textures: Phaser.Textures.TextureManager,
  kind: "input" | "output",
): string {
  const key = `ae-port-${kind}`;
  if (textures.exists(key)) return key;
  const tex = textures.createCanvas(key, TILE, TILE);
  if (tex) {
    drawPort(tex.getContext(), kind);
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

/**
 * 音符（長さ1=♪ 旗つき / 2以上=♩ 旗なし）。c=音高色 h=ハイライト。輪郭(暗色)は drawNote が自動で縁取る。10x10。
 * ♪と同じシルエット（左下に符頭・右に棒・上に旗）。隙間が多いので下のベルト矢印が透けて読める（#153）。
 */
const NOTE_ROWS: Readonly<Record<"short" | "long", readonly string[]>> = {
  // 丸ではなく「♪」の形（玉＋棒＋旗）。短い音は旗つき
  short: [
    "....c.....",
    "....cc....",
    "....c.cc..",
    "....c..cc.",
    "....c...c.",
    "....c.....",
    "..ccc.....",
    ".hccc.....",
    "..cc......",
    "..........",
  ],
  // 長い音は旗なし（玉＋棒）で大きめ
  long: [
    "....c.....",
    "....c.....",
    "....c.....",
    "....c.....",
    "....c.....",
    "....c.....",
    "..ccc.....",
    ".hccc.....",
    "..cc......",
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
  const rows = NOTE_ROWS[length];
  const filled = (x: number, y: number): boolean => {
    const ch = rows[y]?.[x];
    return ch !== undefined && ch !== ".";
  };
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === ".") {
        // 塗りに接する空きは輪郭色（縁取り）
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          ctx.fillStyle = "#140f18";
          ctx.fillRect(x, y, 1, 1);
        }
        return;
      }
      ctx.fillStyle = ch === "h" ? "#ffffff" : hex(color);
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
      ctx.fillStyle = lit ? (PALETTE.a ?? "#f2b45a") : "#3a2f40";
      ctx.fillRect(x, 2, 2, 2);
    };
    lamp(1, frame === 0);
    lamp(TILE - 3, frame === 1);
    tex.refresh();
  }
  return key;
}

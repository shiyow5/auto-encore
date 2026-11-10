# Auto Encore ― 夜更けのオルゴール工房

《Auto Encore ― 夜更けのオルゴール工房》自動化パズル — 音符パーツで自動演奏マシンを組む（ブラウザゲーム / Vite + TypeScript + Phaser 3 + pixelfx）

> 状態: 最小版（11/07）。Pages で遊べます

## 試遊方法

**ブラウザで開くだけで遊べる → https://shiyow5.github.io/auto-encore/**

（`main` に反映されるたび GitHub Pages に自動で公開される。）

**操作方法**: 棚で機械を選び、工房のマスをクリックして置く。`R` で向きを回す、`P` か Shift+クリックで仕分け機の音高を変える、右クリックか `Delete` で消す。組めたら「実行」ボタンで演奏を確かめる（キーボードだけでも矢印キー＋Enter で操作できる）。

**推奨ブラウザ**: Chrome / Edge / Firefox（最新の安定版を推奨）

以下は補助の手順。

### A. CI のビルド済みファイルで遊ぶ（補助）（Node.js 不要）

1. GitHub の **Actions** タブ → `CI` ワークフロー → main の最新の成功した実行を開く
2. 下の **Artifacts** から `game-build` をダウンロードして解凍する（14日で消える）
3. 解凍したフォルダで簡易サーバーを起動し、ブラウザで開く
   ```bash
   cd game-build
   python3 -m http.server 8000
   # → http://localhost:8000 を開く
   ```
   ※ `index.html` をダブルクリックで開くと、ブラウザの制限（file:// で module を読めない）で動かない。必ずサーバー経由で。

gh CLI なら: `gh run download -R shiyow5/auto-encore -n game-build -D game-build`（最新の実行）

### B. 手元でソースから起動する（補助）（Node.js 22 以上）

```bash
git clone https://github.com/shiyow5/auto-encore.git
cd auto-encore
npm ci
npm run dev        # → 表示された http://localhost:5173 を開く
```

## 開発

| コマンド            | 内容                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `npm run dev`       | 開発サーバー（保存すると即反映）                                       |
| `npm test`          | ユニットテスト（Vitest）。ルールのテストはここ                         |
| `npm run test:e2e`  | ブラウザテスト（Playwright）。初回は `npx playwright install chromium` |
| `npm run typecheck` | 型チェック                                                             |
| `npm run build`     | 本番ビルド → `dist/`                                                   |
| `npm run build:e2e` | e2e 用ビルド(`__qa`/`__game` 公開) → `dist-e2e/`                       |

### フォルダ構成と設計方針

- `src/core/` … **ルール（純粋 TypeScript）**。Phaser・DOM・`Math.random`・`Date.now` を使わない。乱数は `Rng`（シード付き）。だから同じシード＋同じ操作なら同じ結果になり、テストとリプレイ（バグ再現）ができる
- `src/scenes/` … 画面（Phaser）。ルールの結果を描くだけ
- `src/fx/` … 演出（pixelfx）。ルールからは参照しない
- `tests/unit/` … Vitest、`e2e/` … Playwright

| 共通部品       | ファイル             | 役割                                                                               |
| -------------- | -------------------- | ---------------------------------------------------------------------------------- |
| シード付き乱数 | `src/core/rng.ts`    | sfc32。`state` で途中保存・再開                                                    |
| グリッド       | `src/core/grid.ts`   | 近傍・走査は固定順（決定性のため）                                                 |
| セーブ         | `src/core/save.ts`   | localStorage。バージョン＋チェックサム（破損・誤コピー検出用。改ざん防止ではない） |
| リプレイ       | `src/core/replay.ts` | シード＋入力列で再生                                                               |

（log-dive / auto-encore で同じ部品をコピーして使っている。リポジトリは別）

## ルール

- 変更は必ずブランチ → PR → CI 通過 → レビュー → マージ。詳細は [CONTRIBUTING.md](CONTRIBUTING.md)
- 素材は自作か、ライセンスを確認した無料素材だけ。**1件ずつ [CREDITS.md](CREDITS.md) に記録**してからコミットする

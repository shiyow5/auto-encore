# QA: テストの置き場所と判定チェックリスト

## 置き場所

| パス              | 中身                                                      |
| ----------------- | --------------------------------------------------------- |
| `tests/qa/`       | ゴールデン・BOT・データ検証など QA が書くテスト（Vitest） |
| `tests/fixtures/` | リプレイ・配置・注文などのフィクスチャ JSON               |
| `e2e/`            | Playwright                                                |

- 実装より先に書くテストは `it.todo` / `test.fixme` にして CI を緑に保つ。**各マイルストーンの判定時に、対象範囲の todo / fixme が 0 件**であることを確認する。
- PR の CI では e2e ジョブは `run-e2e` ラベルが付いたときだけ動く（`.github/workflows/ci.yml`）。e2e を触る PR には `run-e2e` を付ける。

## 判定の共通ルール（全マイルストーン）

1. main の CI 4ジョブ（format / lint / test / e2e）が緑
2. 対象の PR がすべて `Closes #N` 付き、実装者以外の 2 名 LGTM
3. S1・S2 の未解決が 0 件
4. 判定記録に **確認時刻（JST）・commit SHA・実行したコマンドと出力の要点** を書く

## 判定の手順（共通）

```sh
git fetch origin && git checkout --detach origin/main
git rev-parse HEAD                      # → 記録の commit SHA
TZ=Asia/Tokyo date '+%F %T'             # → 記録の確認時刻
gh run list --branch main --workflow CI --limit 1   # main の最新 CI が success か
npm ci
npm run format:check && npm run lint && npm run typecheck
npm test                                 # Vitest
npm run build && npm run test:e2e        # Playwright
grep -rnE --include='*.ts' --include='*.tsx' 'it\.todo|test\.fixme|it\.skip|test\.skip|describe\.skip' tests e2e   # テストソースだけを見る。対象範囲で 0 件か
```

## 縦切りの判定（11/04 21:00〜、23:00 報告。qa-plan-v3 §3-1）

対象: 注文 1 件が機械で完成する。tick 数は「仮の値」として固定（E-U2 未決。決まったら更新 PR を出す）。

| #   | 合格の条件                                                                                | 観点            | 確かめ方                                                | 合否 |
| --- | ----------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------- | ---- |
| E1  | 注文1 の模範解（東向きベルト10本）: result=complete・正確さ100%・cost=10G・finalHash 固定 | AE-18・AE-31①   | 注文1 ゴールデンの Vitest が pass、todo なし            |      |
| E2  | 注文1 でベルトを1本だけ間違える → stalled、例外なし                                       | AE-31・AE-09    | 該当の Vitest が pass                                   |      |
| E3  | 同じ配置を2回再生 → 同じハッシュ／machines 配列の順を入れ替えても同じ                     | AE-16（D1・D2） | 該当の Vitest が pass                                   |      |
| E4  | 画面で注文1 を開く → 模範解を置く → 再生 → 完成表示。コンソールエラー 0                   | AE-17 の前段    | `npm run test:e2e` の smoke（注文1）が pass、fixme なし |      |

縦切りでは判定しないもの: 速度メダル・金銀銅、注文2・3。

### 記録テンプレート

```
確認時刻(JST):
commit SHA (main):
main CI run: <URL> / 結果:
E1: 合否 / コマンド / 出力の要点
E2:
E3:
E4:
残っている todo/fixme（縦切り範囲）: 件数
S1・S2 未解決: 件数
```

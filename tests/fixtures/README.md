# tests/fixtures — QA 用フィクスチャ（Auto Encore）

Issue #6・#8 のフィクスチャ。テストは `tests/qa/ae-fixtures.test.ts`、E2E は `e2e/order-01.spec.ts`（#7）。

- 形は シミュ核（PR #16・#18）の `src/core/sim/types.ts` の `Solution` / 注文 JSON にそろえている。`parseOrder` / `parseSolution` にそのまま渡せる
- 結果の名前もコードにそろえる: `completed`（Issue の「complete」）・`stuck`（Issue の「stalled」）
- tick は **1始まりで数えた仮の値**（E-U2 未決）。仕分け機を通るものは E-U9（仕分け機に1 tick とどまるか）でも1つずれる
- シミュ・Schema が main に無い間は `it.todo` / `test.fixme`。入ったら外す

## solutions/（#6: AE-18・AE-19・AE-31）

`manifest.json` に、AE 番号・合否・途中で見る値（`observe`）・仮の値（`provisional`）を書いている。

| ファイル                  | 内容                                     | 期待                                          |
| ------------------------- | ---------------------------------------- | --------------------------------------------- |
| order-01-frugal.json      | [1,3]〜[10,3] 東向きベルト10本           | completed・100%・18 tick（仮）・10G           |
| order-01-wrong-5-3-W.json | [5,3] だけ西向き                         | t5 で stuck・0%・10G。例外なし                |
| order-01-wrong-5-3-N.json | [5,3] だけ北向き                         | 同上                                          |
| order-01-gap-5-3.json     | [5,3] を空ける                           | t5 で stuck・0%・9G                           |
| order-01-extra-belt.json  | 模範解＋関係ないベルト [5,5]             | frugal と同じ結果・11G（コストのメダル金→銀） |
| order-02-frugal.json      | 仕分け機 [6,2] 東向き「ド」＋ベルト13本  | completed・100%・18 tick（仮）・19G           |
| order-02-sorter-so.json   | 仕分け機の設定を「ソ」                   | completed だが 0% → 不合格                    |
| order-02-no-sorter.json   | 仕分け機なし（[1,2]〜[10,2] ベルト10本） | 高に何も来ず stuck・2/8＝25%（仮）・10G       |

注文1 の5件は PR #18（`feat/e-sim-belt` ffb7e83）の `simulate` で、result・正確さ・ticks・cost と停止 tick（5）が一致することを手元で確認済み（11/03）。注文2 は仕分け機が未実装なので、まだ確かめていない。

## schema/（#6: AE-22・AE-23）

- `orders/valid/order-01.json` を1か所だけ変えた誤例が `orders/invalid/`、`solutions/valid/order-01-frugal.json` を1か所だけ変えた誤例が `solutions/invalid/`
- `orders/valid/order-01-sorter-allowed.json` は order-01 の `allowedMachines` に `sorter` を足しただけの正例。`solutions/invalid/sorter-without-config.json` はこれと組む（order-01 と組むと machine-not-allowed と同じ理由で弾かれてしまうため）
- `manifest.json` の `reason` に何が悪いかを書いている。`undecided` があるものは未決なので判定に使わない（`do:long` は E-U5、入口・出口のマスに置く配置は E-U16）
- `notes` は音符の文字列だけの正例・誤例
- PR #18 の `parseOrder` / `parseSolution` に通した結果（11/03）: 誤例は全部弾かれる。例外は2つ
  - `solutions/invalid/expected-cost-mismatch.json`（expected.cost が 12G、正しくは 10G）は読み込みでは通る。ゴールデンテストで気づく形でよいか、#5 で決める
  - `orders/invalid/note-long.json`（`do:long`）は通る（E-U5 未決のまま）

## boards/（#8: AE-09・AE-10・AE-11）

1ファイルに、ミニ注文（`order`）・配置（`solution`）・期待（`expected`）・見ること（`meta.checks`）を入れている。

| ファイル                       | 見ること                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| ae09-belt-off-board.json       | ベルトの先が盤外 → stuck の前提。expected は E-U3（11/04 合意）まで null            |
| ae09-belt-into-blocked.json    | ベルトの先が塞がりマス → 同上                                                       |
| ae09-belt-into-empty.json      | 対照: ベルトの先が盤内の空きマス → stuck（決まっている側）                          |
| ae10-tuner-backpressure.json   | 調律機（2 tick）の手前で詰まり、入口が捨てずに待つ・出す tick が後ろへずれる        |
| ae10-sorter-dead-end.json      | 仕分け機の右が行き止まり → 仕分け機・後ろ・入口が待って stuck                       |
| ae11-output-exact.json         | 出口が期待数ちょうど → completed                                                    |
| ae11-output-plus-one.json      | 期待数+1 → ちょうどと同じ tick で completed・出口は3個のまま                        |
| ae11-output-full-backs-up.json | 出口1が先に満杯 → 入口Aが待ち、出口2が埋まって completed（A は7個＞受け2＋ベルト3） |

`checks` の意味: `noThrow`＝例外を出さずに止まる、`conservation`＝毎 tick「入口から出た数＝出口が受けた数＋盤上＋機械が持つ数」、`inputDelayed`＝入口が interval どおりより遅れて出す、`outputNeverOverExpect`＝出口が受けた数は期待数を超えない。

ベルトだけの盤面（AE-09 の3つ・AE-11 の3つ）は PR #18 の `simulate` で expected と一致（AE-09 はどれも t3 で stuck）。調律機・仕分け機を使う AE-10 の2つは未実装なので、まだ確かめていない。

## 値を直すとき

E-U2・E-U3・E-U9 が決まったら、`manifest.json` の `provisional` と `boards/*.json` の `expected` を直して、`it.todo` を外す。

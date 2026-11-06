/**
 * src/data/schema/*.schema.json で JSON を検証する（テスト・CI 専用。ゲーム本体には ajv を入れない）。
 *
 * 役割分担（#5）:
 * - Schema: 形だけ（必須キー・型・列挙・範囲）。エディタ補完と CI の一次チェック。
 * - src/core/sim/load.ts: 形＋項目をまたぐ条件（盤外・重なり・メダル順序・orderId 一致・expected.cost）。
 *   実行時に使うのはこちらだけ。Schema の列挙・上限は tests/unit/data-schema.test.ts で load.ts と突き合わせる。
 */
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import orderSchema from "../../src/data/schema/order.schema.json";
import solutionSchema from "../../src/data/schema/solution.schema.json";

const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });

export const validateOrderSchema: ValidateFunction = ajv.compile(orderSchema);
export const validateSolutionSchema: ValidateFunction = ajv.compile(solutionSchema);
export const validateNoteSchema: ValidateFunction = ajv.compile({
  $ref: `${orderSchema.$id}#/$defs/note`,
});

export { orderSchema, solutionSchema };

/** エラーを「パス: 理由」の1行ずつにする（テスト失敗時の表示用）。 */
export function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? []).map((e) => `${e.instancePath || "(root)"}: ${e.message ?? ""}`).join("\n");
}

import type { MachineId, Placement } from "../../core/sim/types";

/**
 * タッチでマスをタップしたとき「置く」ではなく「回す」にするか (Issue #140)。
 * ホバーも R キーも無い端末で、置いた機械の向きを変える手段になる。
 * 選択中と同じ種類の機械が既にあるマスだけ回す。違う種類なら従来どおり置き換える。
 */
export function shouldRotateOnTap(
  pointerType: string | undefined,
  existing: Pick<Placement, "machine"> | undefined,
  selected: MachineId,
): boolean {
  return pointerType === "touch" && existing !== undefined && existing.machine === selected;
}

/** ホバーできない入力環境（スマホ・タブレット）か。 */
export function isHoverNone(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

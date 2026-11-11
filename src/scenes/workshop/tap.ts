import type { MachineId, Pitch, Placement } from "../../core/sim/types";

/**
 * タッチでマスをタップしたとき「置く」ではなく「回す」にするか (Issue #140)。
 * ホバーも R キーも無い端末で、置いた機械の向きを変える手段になる。
 * 選択中と同じ種類の機械が既にあるマスだけ回す。違う種類なら従来どおり置き換える。
 * 仕分け機は音高が次に置く音高と違うとき置き換える（タッチで音高を変える唯一の手段）。
 */
export function shouldRotateOnTap(
  pointerType: string | undefined,
  existing: Pick<Placement, "machine" | "config"> | undefined,
  selected: MachineId,
  nextPitch?: Pitch,
): boolean {
  if (pointerType !== "touch" || existing === undefined || existing.machine !== selected)
    return false;
  const cur = existing.config?.pitch;
  return !(cur !== undefined && nextPitch !== undefined && cur !== nextPitch);
}

/** ホバーできない入力環境（スマホ・タブレット）か。 */
export function isHoverNone(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

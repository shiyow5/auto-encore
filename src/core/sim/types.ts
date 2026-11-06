/**
 * Auto Encore シミュレーション核の型（spec-e-mvp.md v0.3 / review-e-tech.md (b)(c)(d)）。
 *
 * - JSON から読み込んだ後の「検証済み」の形だけをここに置く。JSON の生の形は load.ts が扱う。
 * - 状態はクラスにせず素のオブジェクトにする（複製・ハッシュ・保存のため）。
 * - 数値はすべて整数。座標は左上 (0,0)、x が右、y が下。
 */
import type { Dir, Point } from "../grid";

export const SCHEMA_VERSION = 1;

/** 音高。0=ド, 1=ミ, 2=ソ。調律機は (p + 1) % 3 で1段上げる。 */
export type Pitch = 0 | 1 | 2;
export const PITCH_NAMES = ["do", "mi", "so"] as const;
export type PitchName = (typeof PITCH_NAMES)[number];

/** 長さ。0=短, 1=長（最小版の注文は短のみ）。 */
export type NoteLength = 0 | 1;
export const LENGTH_NAMES = ["short", "long"] as const;
export type LengthName = (typeof LENGTH_NAMES)[number];

export interface Note {
  readonly pitch: Pitch;
  readonly length: NoteLength;
}

/** 機械の向きから見た辺。「左」「右」は向きから見た左右（東向きなら左=北、右=南）。 */
export type Side = "front" | "back" | "left" | "right";
export const SIDES: readonly Side[] = ["front", "back", "left", "right"];

/**
 * 最小版の機械5種。回収箱（bin）は spec-e v0.2 Q6 で戻した（rei 判断 11/06・Issue #41）。連結機は外したまま。
 * 回収箱は後ろから受けた音符をその場で消す（出口が無い・詰まらない）。
 */
export type MachineId = "belt" | "merger" | "sorter" | "tuner" | "bin";
export const MACHINE_IDS: readonly MachineId[] = ["belt", "merger", "sorter", "tuner", "bin"];

/** 同じマスに複数来たときの受け側の規則。動作そのものはコードに書く。 */
export type Arbitration = "alternate";

export interface MachineDef {
  readonly id: MachineId;
  readonly cost: number;
  readonly accepts: readonly Side[];
  readonly emits: readonly Side[];
  /** 入ってから出られるまでの tick 数（調律機=2、他=0）。 */
  readonly processTicks: number;
  readonly arbitration?: Arbitration;
  /** 設定できる値の候補（仕分け機の音高）。無い機械は config を受け付けない。 */
  readonly config?: { readonly pitch: readonly Pitch[] };
}

export type MachineTable = Readonly<Record<MachineId, MachineDef>>;

export interface Board {
  readonly width: number;
  readonly height: number;
  readonly blocked: readonly Point[];
}

/** 入口: pos の1マスを占め、dir の隣のマスへ interval tick ごとに1音出す。詰まったら捨てずに待つ。 */
export interface InputDef {
  readonly id: string;
  readonly pos: Point;
  readonly dir: Dir;
  readonly interval: number;
  readonly notes: readonly Note[];
}

/** 出口: pos の1マスを占め、dir の反対側の隣から受ける。expect の個数に達したら以降受けない。 */
export interface OutputDef {
  readonly id: string;
  readonly pos: Point;
  readonly dir: Dir;
  readonly expect: readonly Note[];
}

/** 金銀銅の閾値。accuracy は大きいほど良い（>=）、ticks・cost は小さいほど良い（<=）。 */
export interface MedalThresholds {
  readonly gold: number;
  readonly silver: number;
  readonly bronze: number;
}

export type PassRule = "all-bronze-or-better";
export type EncoreRule = "two-or-more-gold";

export interface Scoring {
  readonly accuracy: MedalThresholds;
  readonly ticks: MedalThresholds;
  readonly cost: MedalThresholds;
  readonly passRule: PassRule;
  readonly encoreRule: EncoreRule;
}

export interface Order {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly title: string;
  readonly board: Board;
  readonly inputs: readonly InputDef[];
  readonly outputs: readonly OutputDef[];
  readonly allowedMachines: readonly MachineId[];
  /** 注文ごとの上書き。無い機械は machines.json のコスト。 */
  readonly machineCost: Readonly<Partial<Record<MachineId, number>>>;
  /** maxTicks は core 側で 2000 に頭打ちする。machines は個数上限（無ければ無制限）。 */
  readonly limits: {
    readonly maxTicks: number;
    readonly machines: Readonly<Partial<Record<MachineId, number>>>;
  };
  readonly scoring: Scoring;
  readonly unlocks: readonly string[];
  /** src/data/ からの相対パス（例: "solutions/order-01-frugal.json"）。 */
  readonly referenceSolutions: readonly string[];
  /** 画面用の文面。core は読まない。 */
  readonly texts: Readonly<Record<string, unknown>>;
}

export interface Placement {
  readonly machine: MachineId;
  readonly pos: Point;
  readonly dir: Dir;
  /** 仕分け機だけ必須。一致した音高を前へ、不一致を右へ。 */
  readonly config?: { readonly pitch: Pitch };
}

export type StopReason = "completed" | "stuck" | "loop" | "maxTicks";

/** シミュレーションの結果。正確さは整数の割り算前の形で持つ（% 表示は画面側）。 */
export interface SimResult {
  readonly result: StopReason;
  /** completed のときだけ、全出口が期待数を受けた tick。止まったら null。 */
  readonly ticks: number | null;
  /** 全出口の位置一致数の合計。 */
  readonly matched: number;
  /** 全出口の期待数の合計。 */
  readonly total: number;
  /** 総コスト（G）。 */
  readonly cost: number;
  /** 最初にずれた位置（1始まり、全出口を出口ID順につないだ並びで数える）。ずれ無しは null。 */
  readonly firstMismatch: number | null;
  readonly finalHash: string;
}

/** 模範解のゴールデン値。accuracy は整数 % （floor(matched*100/total)）。 */
export interface ExpectedResult {
  readonly result: StopReason;
  readonly accuracy: number;
  readonly ticks: number | null;
  readonly cost: number;
  readonly finalHash?: string;
}

/** プレイヤーの配置・模範解・セーブで共通の形。expected は模範解だけ。 */
export interface Solution {
  readonly schemaVersion: 1;
  readonly orderId: string;
  readonly name: string;
  readonly placements: readonly Placement[];
  readonly expected?: ExpectedResult;
}

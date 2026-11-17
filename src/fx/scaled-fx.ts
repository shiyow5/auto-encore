import { clearFrame, createFrame, createFx } from "pixelfx";
import type { FxInstance, FxModule, PixelFrame } from "pixelfx";

/** painter（draw に渡ってくる）のうち、縮小に使う部分だけの型。 */
interface PainterLike {
  frame: PixelFrame;
  tx: number;
  ty: number;
}

/**
 * pixelfx のエフェクトを k 倍（0 < k <= 1）に縮めた FxModule を作る。
 * pixelfx 本体に縮小オプションが無いので、いったん元の大きさで scratch フレームに描き、
 * 最近傍で間引いて本来のフレームへ写す（ドット絵のままにするため補間しない）。
 * 演出専用。original の meta（duration・options）はそのまま引き継ぐ。
 */
export function scaledFx(mod: FxModule, k: number): FxModule {
  if (!(k > 0 && k <= 1)) throw new RangeError(`scale must be in (0, 1]: ${k}`);
  const meta = (mod.meta ?? {}) as { size?: [number, number]; origin?: [number, number] };
  const [sw, sh] = meta.size ?? [136, 80];
  const [ox, oy] = meta.origin ?? [44, 64];
  // 元のサイズの外へ少しはみ出す粒のために、四方に余白を足す
  const PAD = 16;
  const W = sw + PAD * 2;
  const H = sh + PAD * 2;
  return {
    meta: mod.meta,
    create(opts: Record<string, unknown>) {
      const inner: FxInstance = createFx(mod, { ...opts, x: 0, y: 0, angle: 0, flip: false });
      // scratch の (ox+PAD, oy+PAD) が元エフェクトの原点
      const scratch = createFrame(W, H, -(ox + PAD), -(oy + PAD));
      return {
        update(dt: number) {
          inner.update(dt);
        },
        draw(p: PainterLike) {
          clearFrame(scratch);
          inner.draw(scratch);
          const dst = p.frame;
          const originX = ox + PAD;
          const originY = oy + PAD;
          const x0 = Math.floor(p.tx - originX * k);
          const y0 = Math.floor(p.ty - originY * k);
          const dw = Math.ceil(W * k);
          const dh = Math.ceil(H * k);
          for (let dy = 0; dy < dh; dy++) {
            const ty = y0 + dy - dst.oy;
            if (ty < 0 || ty >= dst.h) continue;
            const sy = Math.min(H - 1, Math.floor((dy + 0.5) / k));
            for (let dx = 0; dx < dw; dx++) {
              const tx = x0 + dx - dst.ox;
              if (tx < 0 || tx >= dst.w) continue;
              const sx = Math.min(W - 1, Math.floor((dx + 0.5) / k));
              const c = scratch.color[sy * W + sx] as number;
              const l = scratch.light[sy * W + sx] as number;
              if (c) dst.color[ty * dst.w + tx] = c;
              if (l) dst.light[ty * dst.w + tx] = l;
            }
          }
        },
      };
    },
  };
}

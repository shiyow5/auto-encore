import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = { stop: vi.fn(), update: vi.fn(), draw: vi.fn(), done: vi.fn(() => false) };
const clearFrame = vi.fn();
const composite = vi.fn();
vi.mock("pixelfx", () => ({
  createFrame: () => ({}),
  createFx: () => fx,
  clearFrame,
  composite,
}));

const putImageData = vi.fn();
const rect = vi.fn(() => ({ left: 10, top: 20, width: 640, height: 360 }));
const canvasEl = () => ({
  width: 0,
  height: 0,
  style: {} as Record<string, string>,
  dataset: {} as Record<string, string>,
  setAttribute: vi.fn(),
  getContext: () => ({ putImageData }),
  remove: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  fx.done.mockReturnValue(false);
  vi.stubGlobal(
    "ImageData",
    class {
      data = new Uint8ClampedArray(4);
    },
  );
  vi.stubGlobal("document", { createElement: () => canvasEl() });
});

async function make() {
  const { DomFxLayer } = await import("../../src/fx/DomFxLayer");
  const host = { append: vi.fn(), getBoundingClientRect: rect };
  const game = { getBoundingClientRect: rect };
  const layer = new DomFxLayer(host as never, game as never, 320, 180);
  return { layer, host };
}

describe("DomFxLayer", () => {
  it("作った canvas を host に追加し、pointer-events: none で overlay と印を付ける", async () => {
    const { layer, host } = await make();
    expect(host.append).toHaveBeenCalledWith(layer.canvas);
    expect(layer.canvas.style.pointerEvents).toBe("none");
    expect(layer.canvas.dataset.fxLayer).toBe("overlay");
  });

  it("演出が無い（active が空）ときは getBoundingClientRect / putImageData を呼ばない", async () => {
    const { layer } = await make();
    rect.mockClear();
    layer.update(0.016);
    layer.update(0.016);
    expect(rect).not.toHaveBeenCalled();
    expect(putImageData).not.toHaveBeenCalled();
  });

  it("演出があるときは位置合わせして描き、終わったら 空の絵に描き直し、以後は呼ばない", async () => {
    const { layer } = await make();
    layer.play({} as never);
    rect.mockClear();
    layer.update(0.016);
    expect(rect).toHaveBeenCalled();
    expect(putImageData).toHaveBeenCalledTimes(1);
    expect(layer.canvas.style.left).toBe("0px");
    expect(layer.canvas.style.width).toBe("640px");

    fx.done.mockReturnValue(true);
    layer.update(0.016); // 終了フレームで空の絵に描き直される
    expect(putImageData).toHaveBeenCalledTimes(2);
    rect.mockClear();
    layer.update(0.016);
    expect(rect).not.toHaveBeenCalled();
    expect(putImageData).toHaveBeenCalledTimes(2);
  });

  it("ttl を過ぎたら stop する", async () => {
    const { layer } = await make();
    layer.play({} as never, {}, 1);
    layer.update(1.5);
    expect(fx.stop).toHaveBeenCalledTimes(1);
  });

  it("destroy で停止して canvas を外す", async () => {
    const { layer } = await make();
    layer.play({} as never);
    layer.destroy();
    expect(fx.stop).toHaveBeenCalled();
    expect(layer.canvas.remove).toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { initialStep, reduce } from "../../src/scenes/workshop/tutorial";

describe("tutorial reduce", () => {
  it("手順1→2→3→完了と進む", () => {
    let s = initialStep("order-01", false);
    expect(s).toBe("place");
    s = reduce(s, "placed");
    expect(s).toBe("rotate");
    s = reduce(s, "rotated");
    expect(s).toBe("run");
    s = reduce(s, "ran");
    expect(s).toBe("done");
  });
  it("順番外のイベントでは進まない・戻らない", () => {
    expect(reduce("place", "rotated")).toBe("place");
    expect(reduce("place", "ran")).toBe("place");
    expect(reduce("rotate", "placed")).toBe("rotate");
    expect(reduce("run", "placed")).toBe("run");
    expect(reduce("run", "rotated")).toBe("run");
  });
  it("スキップはどの手順からでも done", () => {
    for (const s of ["place", "rotate", "run"] as const) expect(reduce(s, "skip")).toBe("done");
  });
  it("done は動かない", () => {
    for (const e of ["placed", "rotated", "ran", "skip"] as const)
      expect(reduce("done", e)).toBe("done");
  });
  it("既完了・order-01 以外は初期状態が done", () => {
    expect(initialStep("order-01", true)).toBe("done");
    expect(initialStep("order-02", false)).toBe("done");
  });
});

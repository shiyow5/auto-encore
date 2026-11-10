/**
 * 縦持ち（画面が縦長）のときに「横にしてください」を出す全面オーバーレイ（Issue #123）。
 * 縦は非対応とする（A案）。横に戻すと自動で消える。PC・横持ちの表示は変えない。
 */

const HINT_ID = "rotate-hint";

/** 画面が縦長か（幅 < 高さ）。 */
export function isPortrait(width: number, height: number): boolean {
  return width < height;
}

/** 縦持ちのときだけ、全面の「横にしてください」オーバーレイを出す。resize で追従する。 */
export function installRotateHint(): void {
  if (document.getElementById(HINT_ID)) return;
  const hint = document.createElement("div");
  hint.id = HINT_ID;
  hint.setAttribute("role", "status");
  hint.textContent = "スマホを横向きにしてください";
  Object.assign(hint.style, {
    position: "fixed",
    inset: "0",
    zIndex: "1000",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    boxSizing: "border-box",
    background: "#1e1722",
    color: "#f0b25a",
    fontSize: "18px",
    textAlign: "center",
    lineHeight: "1.6",
  });
  const update = () => {
    hint.style.display = isPortrait(window.innerWidth, window.innerHeight) ? "flex" : "none";
  };
  window.addEventListener("resize", update);
  document.body.append(hint);
  update();
}

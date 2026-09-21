export const DIRECTIONAL_ICON_CLASS = "rtl:-scale-x-100";

export function logicalSide(side: "start" | "end"): "start" | "end" {
  return side;
}

export function isRtlDocument(): boolean {
  return typeof document !== "undefined" && document.documentElement.dir === "rtl";
}

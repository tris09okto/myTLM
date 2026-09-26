export function taskOrderReplyTarget(senderRole: unknown): "MO" | "HRD" | null {
  if (typeof senderRole !== "string") return null;
  const normalized = senderRole.toUpperCase().replace(/[^A-Z]/g, "");
  if (["MO", "ADMINMO", "MOADMIN"].includes(normalized)) return "MO";
  if (["HRD", "ADMINHRD", "HRDMANAGER"].includes(normalized)) return "HRD";
  return null;
}

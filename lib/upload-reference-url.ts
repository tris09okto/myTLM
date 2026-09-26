export function uploadReferenceUrl(
  reference: unknown,
  localFolder = "",
): string | null {
  if (typeof reference !== "string") return null;

  const value = reference.trim();

  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/uploads/")) return value;

  const normalized = value.startsWith("uploads/")
    ? value.slice("uploads/".length)
    : value;
  const parts = normalized.split("/");

  if (parts.some((part) => !part || part === "." || part === "..")) return null;

  const folderParts = localFolder.split("/").filter(Boolean);

  return `/uploads/${[...folderParts, ...parts].map(encodeURIComponent).join("/")}`;
}

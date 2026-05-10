import { File } from "lucide-react";

export const inputCls =
  "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function parseBreadcrumbs(path: string) {
  const parts = path.split("/").filter(Boolean);
  const crumbs: { label: string; path: string }[] = [{ label: "Root", path: "/" }];
  let acc = "/";
  for (const part of parts) {
    acc = `${acc}${part}/`;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

export function MimeIcon({ mimeType, size = 18 }: { mimeType: string | null; size?: number }) {
  if (!mimeType) return <File size={size} className="text-slate-400" />;
  if (mimeType.startsWith("image/")) return <File size={size} className="text-emerald-500" />;
  if (mimeType === "application/pdf") return <File size={size} className="text-red-500" />;
  if (mimeType.includes("word") || mimeType.includes("document"))
    return <File size={size} className="text-blue-500" />;
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return <File size={size} className="text-green-500" />;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return <File size={size} className="text-orange-500" />;
  if (mimeType.startsWith("video/")) return <File size={size} className="text-purple-500" />;
  if (mimeType.startsWith("audio/")) return <File size={size} className="text-pink-500" />;
  return <File size={size} className="text-slate-400" />;
}

export function previewType(mimeType: string | null): "image" | "video" | "pdf" | "none" {
  if (!mimeType) return "none";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType === "application/pdf") return "pdf";
  return "none";
}

import { useRef, useState } from "react";
import { Form, useFetcher, useLoaderData, useNavigation } from "react-router";
import {
  CheckCircle2,
  Download,
  File,
  FileText,
  FileVideo,
  FileImage,
  FileArchive,
  HardDrive,
  Link2,
  Loader2,
  Music,
  Plus,
  QrCode,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import type { Route } from "./+types/storage";

export function meta() {
  return [{ title: "Storage | UniBuddy" }];
}

const PERSONAL_STORAGE_LIMIT_BYTES = 100 * 1024 * 1024;

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { listPersonalFiles, getPersonalStorageUsage } = await import(
    "~/lib/personal-storage.server"
  );
  const { env } = await import("~/lib/env.server");

  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect("/login");

  const [files, usedBytes] = await Promise.all([
    listPersonalFiles(user.id),
    getPersonalStorageUsage(user.id),
  ]);

  return { files, usedBytes, r2PublicUrl: env.R2_PUBLIC_URL };
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { uploadPersonalFile } = await import("~/lib/personal-storage.server");
  const { serializeFlash } = await import("~/lib/flash.server");

  const user = await getAuthenticatedUser(request);
  if (!user) throw redirect("/login");

  await rateLimit({ key: `storage-upload:${user.id}`, limit: 20, windowSec: 60 });

  const formData = await request.formData();
  const file = formData.get("file");

  const headers = new Headers();

  if (!file || typeof file === "string" || (file as File).size === 0) {
    headers.append(
      "Set-Cookie",
      await serializeFlash({ type: "error", message: "No file selected." }),
    );
    throw redirect("/dashboard/storage", { headers });
  }

  // Max file name length guard
  if (file.name.length > 200) {
    headers.append(
      "Set-Cookie",
      await serializeFlash({ type: "error", message: "File name too long (max 200 chars)." }),
    );
    throw redirect("/dashboard/storage", { headers });
  }

  try {
    await uploadPersonalFile(user.id, {
      name: file.name,
      size: file.size,
      mimeType: file.type,
      arrayBuffer: () => file.arrayBuffer(),
    });
    headers.append(
      "Set-Cookie",
      await serializeFlash({ type: "success", message: `"${file.name}" uploaded.` }),
    );
  } catch (err) {
    const msg =
      err instanceof Error && err.message === "STORAGE_LIMIT_EXCEEDED"
        ? "Storage limit reached (100 MB)."
        : err instanceof Error && err.message === "FILE_TOO_LARGE"
          ? "File is too large (max 50 MB per file)."
          : "Upload failed. Please try again.";
    headers.append("Set-Cookie", await serializeFlash({ type: "error", message: msg }));
  }

  throw redirect("/dashboard/storage", { headers });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return Music;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return FileText;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip")
  )
    return FileArchive;
  return File;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── QR Modal ──────────────────────────────────────────────────────────────────

function QRModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  // Use a free QR code API — no external dependency needed
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-bold text-slate-900">QR Code</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4 px-6 py-6">
          <p className="text-center text-xs font-medium text-slate-500 leading-relaxed">
            Scan to download <span className="font-bold text-slate-800">"{name}"</span>
          </p>
          <img src={qrSrc} alt="QR code" className="h-[220px] w-[220px] rounded-xl border border-slate-200" />
          <p className="break-all text-center text-[10px] text-slate-400">{url}</p>
        </div>
      </div>
    </div>
  );
}

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ usedBytes }: { usedBytes: number }) {
  const fetcher = useFetcher();
  const isUploading = fetcher.state !== "idle";
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const usedPct = Math.min((usedBytes / PERSONAL_STORAGE_LIMIT_BYTES) * 100, 100);
  const remaining = PERSONAL_STORAGE_LIMIT_BYTES - usedBytes;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setSelectedFile(f);
  }

  function handleUpload() {
    if (!selectedFile || isUploading) return;
    const fd = new FormData();
    fd.append("file", selectedFile, selectedFile.name);
    fetcher.submit(fd, { method: "post", encType: "multipart/form-data" });
    setSelectedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-900">Upload File</h2>
          </div>
          <span className="text-xs text-slate-500">
            {fmtBytes(usedBytes)} / 100 MB used
          </span>
        </div>
        {/* Storage bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${usedPct > 85 ? "bg-red-500" : usedPct > 60 ? "bg-amber-500" : "bg-indigo-500"}`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] text-slate-400">{fmtBytes(remaining)} free</p>
      </div>

      <div className="p-5">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition ${
            dragging
              ? "border-indigo-400 bg-indigo-50"
              : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60"
          }`}
        >
          <Upload size={28} className={dragging ? "text-indigo-500" : "text-slate-300"} />
          {selectedFile ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
              <p className="text-xs text-slate-400">{fmtBytes(selectedFile.size)}</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-600">Drop a file here</p>
              <p className="text-xs text-slate-400">or click to browse — max 50 MB per file</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setSelectedFile(f);
            }}
          />
        </div>

        {selectedFile && (
          <button
            type="button"
            disabled={isUploading}
            onClick={handleUpload}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Plus size={15} />
                Upload "{selectedFile.name}"
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StorageFile = {
  id: string;
  key: string;
  name: string;
  size: number;
  mimeType: string | null;
  shareToken: string;
  createdAt: string | Date;
};

export default function StoragePage() {
  const { files, usedBytes, r2PublicUrl } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<StorageFile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function fileUrl(key: string) {
    return `${r2PublicUrl}/${key}`;
  }

  function copyLink(file: StorageFile) {
    navigator.clipboard.writeText(fileUrl(file.key));
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      {qrFile && (
        <QRModal
          url={fileUrl(qrFile.key)}
          name={qrFile.name}
          onClose={() => setQrFile(null)}
        />
      )}

      <div className="space-y-5">
        {/* Upload card */}
        <UploadZone usedBytes={usedBytes} />

        {/* File list */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold text-slate-900">
              My Files
              {files.length > 0 && (
                <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {files.length}
                </span>
              )}
            </h2>
          </div>

          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <HardDrive size={22} />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No files yet</p>
              <p className="mt-1 text-xs text-slate-400">Upload a file above to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(files as StorageFile[]).map((file) => {
                const Icon = getFileIcon(file.mimeType);
                const isDeleting =
                  navigation.state === "submitting" &&
                  navigation.formData?.get("fileId") === file.id;

                return (
                  <div key={file.id} className="flex items-center gap-3 px-5 py-3.5">
                    {/* Icon */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                      <Icon size={17} className="text-indigo-500" />
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-400">
                        {fmtBytes(file.size)} · {fmtDate(file.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex shrink-0 items-center gap-1">
                      {/* Copy link */}
                      <button
                        type="button"
                        onClick={() => copyLink(file)}
                        title="Copy share link"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                      >
                        {copiedId === file.id ? (
                          <CheckCircle2 size={15} className="text-emerald-500" />
                        ) : (
                          <Link2 size={15} />
                        )}
                      </button>

                      {/* QR code */}
                      <button
                        type="button"
                        onClick={() => setQrFile(file)}
                        title="Show QR code"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                      >
                        <QrCode size={15} />
                      </button>

                      {/* Download */}
                      <a
                        href={fileUrl(file.key)}
                        download={file.name}
                        title="Download"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
                      >
                        <Download size={15} />
                      </a>

                      {/* Delete */}
                      {deleteConfirmId === file.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100"
                          >
                            No
                          </button>
                          <Form method="post" action="/api/storage/delete" preventScrollReset>
                            <input type="hidden" name="fileId" value={file.id} />
                            <button
                              type="submit"
                              disabled={isDeleting}
                              className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            >
                              {isDeleting ? "…" : "Yes"}
                            </button>
                          </Form>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(file.id)}
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

"use client";

import { useCallback, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  FileImage,
  FileSpreadsheet,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { DocumentKind, TenantDocument } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "tenant-docs";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.docx,.doc,.txt,.md,.csv,.xlsx";
const MAX_SIZE_MB = 15;

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  menu: "Menu",
  promotion: "Promotion",
  wine_list: "Wine & drinks",
  brand: "Brand & story",
  policy: "House policies",
  other: "Other",
};

const KIND_BADGE: Record<DocumentKind, string> = {
  menu: "bg-[#eef6f1] text-pos",
  promotion: "bg-[#f4dbb1] text-[#5c430e]",
  wine_list: "bg-[#f3e8f4] text-[#6b3a72]",
  brand: "bg-[#e8eef6] text-[#2c4a72]",
  policy: "bg-[#edeadf] text-ink-soft",
  other: "bg-line-soft text-ink-faint",
};

// What owners most often have on hand — shown in the empty state so the
// first upload is a recognition task, not a blank page.
const SUGGESTIONS: { kind: DocumentKind; label: string }[] = [
  { kind: "menu", label: "Current menu" },
  { kind: "promotion", label: "Running promotions" },
  { kind: "wine_list", label: "Wine & cocktail list" },
  { kind: "brand", label: "Brand one-pager" },
];

/** Guess the document kind from its file name — owner can always correct it. */
function guessKind(fileName: string): DocumentKind {
  const n = fileName.toLowerCase();
  if (/(menu|carte|dinner|lunch|brunch|dessert)/.test(n)) return "menu";
  if (/(promo|special|happy.?hour|event|offer|deal)/.test(n)) return "promotion";
  if (/(wine|drink|cocktail|beverage|bar)/.test(n)) return "wine_list";
  if (/(brand|story|voice|about|press)/.test(n)) return "brand";
  if (/(policy|policies|handbook|dress|reservation)/.test(n)) return "policy";
  return "other";
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (/(csv|excel|spreadsheet)/.test(mime)) return FileSpreadsheet;
  return FileText;
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Keep the storage key clean; the original name is preserved in file_name. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

interface RestaurantDocumentsProps {
  tenantId: string | null;
  initialDocuments?: TenantDocument[];
}

/**
 * The document vault — menus, promotions, wine lists, brand notes.
 * Files go to the private 'tenant-docs' Storage bucket at
 * {tenant_id}/{document_id}/{file_name}; metadata rows live in
 * tenant_documents. Both are RLS-scoped to the tenant.
 */
export default function RestaurantDocuments({
  tenantId,
  initialDocuments = [],
}: RestaurantDocumentsProps) {
  const [docs, setDocs] = useState<TenantDocument[]>(initialDocuments);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      if (!tenantId) {
        setError("We couldn't confirm your account — try reloading the page.");
        return;
      }
      const incoming = Array.from(files);
      const tooBig = incoming.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
      if (tooBig) {
        setError(`"${tooBig.name}" is over ${MAX_SIZE_MB} MB — try a smaller export.`);
        return;
      }

      const supabase = createClient();

      for (const file of incoming) {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const storagePath = `${tenantId}/${id}/${safeName(file.name)}`;
        const doc: TenantDocument = {
          id,
          tenant_id: tenantId,
          kind: guessKind(file.name),
          title: file.name.replace(/\.[^.]+$/, ""),
          file_name: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_path: storagePath,
          uploaded_at: new Date().toISOString(),
          status: "processing",
        };

        // Optimistic row while the upload runs
        setDocs((prev) => [doc, ...prev]);

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, file, {
            contentType: doc.mime_type,
            upsert: false,
          });
        if (upErr) {
          setDocs((prev) => prev.filter((d) => d.id !== id));
          setError(`Couldn't upload "${file.name}" — ${upErr.message}`);
          continue;
        }

        const { error: dbErr } = await supabase.from("tenant_documents").insert({
          id,
          tenant_id: tenantId,
          kind: doc.kind,
          title: doc.title,
          file_name: doc.file_name,
          mime_type: doc.mime_type,
          size_bytes: doc.size_bytes,
          storage_path: storagePath,
          status: "ready",
          uploaded_at: doc.uploaded_at,
        });
        if (dbErr) {
          // Roll back the orphaned object so storage and table stay in sync
          await supabase.storage.from(BUCKET).remove([storagePath]);
          setDocs((prev) => prev.filter((d) => d.id !== id));
          setError(`Couldn't save "${file.name}" — please try again.`);
          continue;
        }

        setDocs((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status: "ready" as const } : d))
        );
      }
    },
    [tenantId]
  );

  async function removeDoc(id: string) {
    const target = docs.find((d) => d.id === id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
    const supabase = createClient();
    if (target?.storage_path) {
      await supabase.storage.from(BUCKET).remove([target.storage_path]);
    }
    await supabase.from("tenant_documents").delete().eq("id", id);
  }

  async function setKind(id: string, kind: DocumentKind) {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, kind } : d)));
    const supabase = createClient();
    await supabase.from("tenant_documents").update({ kind }).eq("id", id);
  }

  const readyCount = docs.filter((d) => d.status === "ready").length;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all select-none",
          dragOver
            ? "border-forest bg-[#f0f4ee] scale-[1.01]"
            : "border-line hover:border-forest/50 hover:bg-[#fbfaf5]"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div
          className={cn(
            "mx-auto w-11 h-11 rounded-full flex items-center justify-center mb-3 transition-colors",
            dragOver ? "bg-forest text-paper" : "bg-line-soft text-ink-soft"
          )}
        >
          <UploadCloud className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-ink">
          {dragOver ? "Drop to upload" : "Drag & drop your documents"}
        </p>
        <p className="text-xs text-ink-faint mt-1">
          or <span className="text-forest font-medium underline underline-offset-2">browse files</span>
          {" "}· PDF, images, Word, spreadsheets · up to {MAX_SIZE_MB} MB each
        </p>
      </div>

      {error && (
        <p className="text-xs text-neg font-medium" role="alert">
          {error}
        </p>
      )}

      {/* Empty state: suggest what to upload */}
      {docs.length === 0 ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-ink-faint">Great first uploads:</span>
          {SUGGESTIONS.map((s) => (
            <span
              key={s.kind}
              className={cn(
                "text-[11px] font-semibold rounded-full px-2.5 py-1",
                KIND_BADGE[s.kind]
              )}
            >
              {s.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="bg-paper rounded-2xl border border-line overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-[#faf8f2]">
            <p className="text-xs font-semibold text-ink">
              {docs.length} document{docs.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-ink-faint">
              {readyCount === docs.length
                ? "All ready for the AI ✓"
                : `${readyCount}/${docs.length} ready for the AI`}
            </p>
          </div>
          <div className="divide-y divide-line-soft">
            {docs.map((doc) => {
              const Icon = fileIcon(doc.mime_type);
              return (
                <div key={doc.id} className="px-5 py-3.5 flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-line-soft flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-ink-soft" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{doc.title}</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      {fmtSize(doc.size_bytes)} ·{" "}
                      {new Date(doc.uploaded_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Kind — auto-guessed, owner can correct */}
                  <label className="sr-only" htmlFor={`kind-${doc.id}`}>
                    Document type
                  </label>
                  <select
                    id={`kind-${doc.id}`}
                    value={doc.kind}
                    onChange={(e) => setKind(doc.id, e.target.value as DocumentKind)}
                    className={cn(
                      "text-[11px] font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer appearance-none text-center",
                      KIND_BADGE[doc.kind]
                    )}
                  >
                    {(Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[]).map((k) => (
                      <option key={k} value={k}>
                        {DOCUMENT_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>

                  {/* Status */}
                  {doc.status === "ready" ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-pos shrink-0 w-24 justify-end">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready for AI
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-ink-faint shrink-0 w-24 justify-end">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading…
                    </span>
                  )}

                  <button
                    onClick={() => removeDoc(doc.id)}
                    title={`Remove ${doc.title}`}
                    className="text-ink-faint hover:text-neg transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

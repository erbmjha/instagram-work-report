import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, ChevronLeft, ChevronRight, Copy, Download, FileImage, FilePlus, Plus, Trash2 } from "lucide-react";
import {
  BUCKETS,
  type BucketId,
  type Block,
  type Report,
  applyDateLinks,
  bucketHeading,
  buildBlocks,
  duplicateCodes,
  extractUrls,
  fileSlug,
  formatLongDate,
  freshReport,
  todayISO,
  groupTotals,
  isInstagramUrl,
  linkTotal,
  shortcode,
  toDocHtml,
  toHtml,
  toPlain,
} from "@/lib/report";

const STORAGE_KEY = "ig-work-report-desk-v1";
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function screenshotFile(iso: string): string | null {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return null;
  return `Report [${day} ${MONTH_SHORT[month - 1]} ${year}]- Insta UGC and Posting.pdf`;
}

type Store = { draft: Report; saved: Report[] };

function normalizeReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<Report>;
  if (typeof value.id !== "string" || !value.id) return null;
  const base = freshReport();
  const incoming = value.buckets && typeof value.buckets === "object" ? value.buckets : {};
  for (const def of BUCKETS) {
    const list = (incoming as Record<string, unknown>)[def.id];
    base.buckets[def.id] = Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
  }
  return {
    id: value.id,
    campaign: typeof value.campaign === "string" ? value.campaign : "",
    date: typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : base.date,
    buckets: base.buckets,
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

function readStore(): Store | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Store>;
    const draft = normalizeReport(parsed.draft);
    if (!draft) return null;
    const saved = Array.isArray(parsed.saved)
      ? parsed.saved.map(normalizeReport).filter((item): item is Report => item !== null)
      : [];
    return { draft, saved };
  } catch {
    return null;
  }
}

function writeStore(store: Store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function upsertSaved(saved: Report[], report: Report): Report[] {
  if (linkTotal(report) === 0 && !report.campaign.trim()) return saved;
  const next = saved.filter((item) => item.id !== report.id);
  next.unshift({ ...report, buckets: structuredClone(report.buckets) });
  return next.slice(0, 40);
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthStart(iso: string): Date {
  const [year, month] = iso.split("-").map(Number);
  if (!year || !month) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return new Date(year, month - 1, 1);
}

function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => monthStart(value));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, index) => index + 1)];
  const today = todayISO();

  return (
    <div ref={root} className="relative">
      <span className="mb-1 block text-sm font-medium">Date</span>
      <button
        id="report-date"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setCursor(monthStart(value));
          setOpen((current) => !current);
        }}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-md border border-ink/20 bg-paper px-3 text-left text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="truncate">{value ? formatLongDate(value) : "Pick a date"}</span>
        <Calendar className="size-4 shrink-0 text-accent" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 z-30 mt-1.5 w-72 border border-ink/25 bg-paper p-3 shadow-[4px_4px_0_rgba(28,23,18,0.12)] sm:left-auto sm:right-0"
        >
          <div className="flex items-center justify-between border-b border-line pb-2">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
              className="grid size-8 place-items-center border border-line bg-surface text-ink hover:border-ink"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <p className="text-sm font-semibold tracking-wide">
              {MONTH_NAMES[month]} {year}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
              className="grid size-8 place-items-center border border-line bg-surface text-ink hover:border-ink"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold tracking-wider text-muted uppercase">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, index) => {
              if (!day) return <span key={`blank-${index}`} className="size-9" />;
              const iso = isoFromParts(year, month, day);
              const selected = iso === value;
              const isToday = iso === today;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={`mx-auto grid size-9 place-items-center text-sm tabular-nums ${
                    selected
                      ? "bg-accent font-semibold text-accent-fg"
                      : isToday
                        ? "font-semibold text-accent underline decoration-2 underline-offset-4"
                        : "hover:bg-surface"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(today);
              setCursor(monthStart(today));
              setOpen(false);
            }}
            className="mt-2 w-full border-t border-line pt-2 text-center text-sm font-semibold text-accent"
          >
            Today
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function WorkDesk() {
  const [store, setStore] = useState<Store>(() => ({ draft: freshReport(), saved: [] }));
  const [booted, setBooted] = useState(false);
  const [panel, setPanel] = useState<"fill" | "preview">("fill");
  const [pastes, setPastes] = useState<Partial<Record<BucketId, string>>>({});
  const [notes, setNotes] = useState<Partial<Record<BucketId, string>>>({});
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [ssMissing, setSsMissing] = useState(false);

  useEffect(() => {
    setSsMissing(false);
  }, [store.draft.date]);

  useEffect(() => {
    const loaded = readStore();
    const base = loaded?.draft ?? freshReport();
    setStore({
      draft: applyDateLinks(base, todayISO()),
      saved: loaded?.saved ?? [],
    });
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;
    writeStore(store);
  }, [store, booted]);

  const draft = store.draft;
  const totals = groupTotals(draft);
  const dupes = useMemo(() => duplicateCodes(draft), [draft]);
  const blocks = useMemo(() => buildBlocks(draft), [draft]);

  function commit(next: Report, saved = store.saved) {
    setStore({ draft: { ...next, updatedAt: Date.now() }, saved });
  }

  function patch(partial: Partial<Report>) {
    commit({ ...draft, ...partial });
  }

  function setBucket(id: BucketId, links: string[]) {
    commit({ ...draft, buckets: { ...draft.buckets, [id]: links } });
  }

  function addToBucket(id: BucketId, raw: string) {
    const incoming = extractUrls(raw);
    if (incoming.length === 0) {
      setNotes((prev) => ({ ...prev, [id]: "Koi link nahi mila. Poora Instagram URL paste karo." }));
      return;
    }
    const existing = new Set(draft.buckets[id]);
    const added: string[] = [];
    for (const url of incoming) {
      if (existing.has(url)) continue;
      existing.add(url);
      added.push(url);
    }
    setBucket(id, [...draft.buckets[id], ...added]);
    setPastes((prev) => ({ ...prev, [id]: "" }));
    const skipped = incoming.length - added.length;
    setNotes((prev) => ({
      ...prev,
      [id]: skipped > 0 ? `${added.length} add hue, ${skipped} pehle se the.` : `${added.length} link add hue.`,
    }));
  }

  function editLink(id: BucketId, index: number, url: string) {
    const links = draft.buckets[id].map((item, i) => (i === index ? url : item));
    setBucket(id, links);
  }

  function removeLink(id: BucketId, index: number) {
    setBucket(
      id,
      draft.buckets[id].filter((_, i) => i !== index),
    );
  }

  function moveLink(from: BucketId, index: number, to: BucketId) {
    if (from === to) return;
    const url = draft.buckets[from][index];
    if (!url) return;
    const fromLinks = draft.buckets[from].filter((_, i) => i !== index);
    const toLinks = draft.buckets[to].includes(url) ? draft.buckets[to] : [...draft.buckets[to], url];
    commit({
      ...draft,
      buckets: { ...draft.buckets, [from]: fromLinks, [to]: toLinks },
    });
  }

  function saveCopy() {
    setStore((prev) => ({ ...prev, saved: upsertSaved(prev.saved, prev.draft) }));
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function startNew() {
    setStore((prev) => ({
      draft: freshReport(),
      saved: upsertSaved(prev.saved, prev.draft),
    }));
    setPastes({});
    setNotes({});
    setPanel("fill");
  }

  function openSaved(id: string) {
    const found = store.saved.find((item) => item.id === id);
    if (!found) return;
    setStore((prev) => ({
      draft: applyDateLinks(
        {
          ...found,
          buckets: structuredClone(found.buckets),
        },
        found.date,
      ),
      saved: upsertSaved(prev.saved, prev.draft),
    }));
    setPanel("fill");
  }

  function deleteSaved(id: string) {
    setStore((prev) => ({ ...prev, saved: prev.saved.filter((item) => item.id !== id) }));
  }

  async function copyReport() {
    const text = toPlain(draft);
    const html = toHtml(draft);
    setCopyError(false);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopyError(true);
      }
    }
  }

  function downloadDoc() {
    const blob = new Blob([toDocHtml(draft)], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileSlug(draft)}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadScreenshot() {
    const file = screenshotFile(draft.date);
    if (!file) {
      setSsMissing(true);
      return;
    }
    const href = `/reports/${encodeURIComponent(file)}`;
    try {
      let response = await fetch(href, { method: "HEAD" });
      if (response.status === 405) response = await fetch(href);
      if (!response.ok) {
        setSsMissing(true);
        return;
      }
    } catch {
      setSsMissing(true);
      return;
    }
    setSsMissing(false);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = file;
    anchor.click();
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 lg:pb-10">
        <header className="no-print flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-accent">Daily desk</p>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Instagram Work Report</h1>
            </div>
            <div className="hidden gap-2 lg:flex">
              <ActionButtons
                copied={copied}
                savedFlash={savedFlash}
                ssMissing={ssMissing}
                onCopy={copyReport}
                onScreenshot={downloadScreenshot}
                onDownload={downloadDoc}
                onSave={saveCopy}
                onNew={startNew}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Campaign</span>
              <input
                id="campaign"
                value={draft.campaign}
                onChange={(event) => patch({ campaign: event.target.value })}
                placeholder="CJP Protest"
                className="h-11 w-full rounded-lg border border-line bg-paper px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
            <DateField value={draft.date} onChange={(iso) => commit(applyDateLinks(draft, iso))} />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Stat label="Total" value={totals.total} />
            <Stat label="UGC" value={totals.ugc} />
            <Stat label="Premium" value={totals.premium} />
            <Stat label="Meme" value={totals.meme} />
            <Stat label="Political" value={totals.political} />
          </div>

          {dupes.size > 0 ? (
            <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-accent">
              {dupes.size} reel {dupes.size === 1 ? "do" : "kai"} section mein repeat ho raha hai.
            </p>
          ) : null}
          {copyError ? (
            <p className="text-sm text-accent">Copy nahi ho paya. Download use karo.</p>
          ) : null}
        </header>

        <div className="no-print mt-4 flex gap-2 lg:hidden">
          <PanelTab active={panel === "fill"} onClick={() => setPanel("fill")}>
            Fill
          </PanelTab>
          <PanelTab active={panel === "preview"} onClick={() => setPanel("preview")}>
            Preview
          </PanelTab>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <section className={panel === "fill" ? "block" : "hidden lg:block"}>
            <div className="no-print flex flex-col gap-3">
              <div className="rounded-xl border border-line bg-surface p-3">
                <h2 className="text-base font-semibold">UGC Videos</h2>
              </div>
              {BUCKETS.filter((def) => def.kind === "ugc").map((def) => (
                <BucketCard
                  key={def.id}
                  id={def.id}
                  links={draft.buckets[def.id]}
                  paste={pastes[def.id] ?? ""}
                  note={notes[def.id] ?? ""}
                  dupes={dupes}
                  onPaste={(value) => setPastes((prev) => ({ ...prev, [def.id]: value }))}
                  onAdd={() => addToBucket(def.id, pastes[def.id] ?? "")}
                  onEdit={(index, url) => editLink(def.id, index, url)}
                  onRemove={(index) => removeLink(def.id, index)}
                  onMove={(index, to) => moveLink(def.id, index, to)}
                />
              ))}

              <div className="rounded-xl border border-line bg-surface p-3">
                <h2 className="text-base font-semibold">Meme aur Political</h2>
              </div>
              {BUCKETS.filter((def) => def.kind === "solo").map((def) => (
                <BucketCard
                  key={def.id}
                  id={def.id}
                  links={draft.buckets[def.id]}
                  paste={pastes[def.id] ?? ""}
                  note={notes[def.id] ?? ""}
                  dupes={dupes}
                  onPaste={(value) => setPastes((prev) => ({ ...prev, [def.id]: value }))}
                  onAdd={() => addToBucket(def.id, pastes[def.id] ?? "")}
                  onEdit={(index, url) => editLink(def.id, index, url)}
                  onRemove={(index) => removeLink(def.id, index)}
                  onMove={(index, to) => moveLink(def.id, index, to)}
                />
              ))}

              {store.saved.length > 0 ? (
                <details className="rounded-xl border border-line bg-surface p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Saved reports ({store.saved.length})</summary>
                  <ul className="mt-3 flex flex-col gap-2">
                    {store.saved.map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openSaved(item.id)}
                          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm"
                        >
                          <span className="block truncate font-medium">{item.campaign.trim() || "Untitled"}</span>
                          <span className="text-muted">
                            {formatLongDate(item.date)} · {linkTotal(item)} links
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.campaign || "saved report"}`}
                          onClick={() => deleteSaved(item.id)}
                          className="flex size-11 items-center justify-center rounded-lg border border-line bg-paper text-ink"
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </section>

          <section className={`paper-col ${panel === "preview" ? "block" : "hidden lg:block"}`}>
            <div className="lg:sticky lg:top-4">
              <Paper blocks={blocks} />
            </div>
          </section>
        </div>
      </div>

      <div className="dock no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface px-3 pt-3 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <p className="min-w-12 text-sm font-semibold tabular-nums">{totals.total}</p>
          <button
            type="button"
            onClick={copyReport}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-fg"
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy report"}
          </button>
          <button
            type="button"
            onClick={downloadScreenshot}
            aria-label={ssMissing ? "No screenshot report for this date" : "Download screenshot report"}
            className="flex h-11 items-center justify-center gap-1 rounded-lg border border-line bg-paper px-2.5 text-sm font-medium"
          >
            <FileImage className="size-4" aria-hidden="true" />
            {ssMissing ? "No SS" : "SS"}
          </button>
          <button
            type="button"
            onClick={downloadDoc}
            aria-label="Download doc"
            className="flex size-11 items-center justify-center rounded-lg border border-line bg-paper"
          >
            <Download className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </main>
  );
}

function ActionButtons({
  copied,
  savedFlash,
  ssMissing,
  onCopy,
  onScreenshot,
  onDownload,
  onSave,
  onNew,
}: {
  copied: boolean;
  savedFlash: boolean;
  ssMissing: boolean;
  onCopy: () => void;
  onScreenshot: () => void;
  onDownload: () => void;
  onSave: () => void;
  onNew: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCopy}
        className="flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors duration-150"
      >
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy report"}
      </button>
      <button
        type="button"
        onClick={onScreenshot}
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium"
      >
        <FileImage className="size-4" aria-hidden="true" />
        {ssMissing ? "No SS" : "SS"}
      </button>
      <button
        type="button"
        onClick={onDownload}
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium"
      >
        <Download className="size-4" aria-hidden="true" />
        Doc
      </button>
      <button
        type="button"
        onClick={onSave}
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium"
      >
        {savedFlash ? <Check className="size-4" aria-hidden="true" /> : null}
        {savedFlash ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={onNew}
        className="flex h-11 items-center gap-2 rounded-lg border border-line bg-paper px-3 text-sm font-medium"
      >
        <FilePlus className="size-4" aria-hidden="true" />
        New
      </button>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-11 flex-1 rounded-lg border text-sm font-semibold ${
        active ? "border-accent bg-accent text-accent-fg" : "border-line bg-paper text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function BucketCard({
  id,
  links,
  paste,
  note,
  dupes,
  onPaste,
  onAdd,
  onEdit,
  onRemove,
  onMove,
}: {
  id: BucketId;
  links: string[];
  paste: string;
  note: string;
  dupes: Set<string>;
  onPaste: (value: string) => void;
  onAdd: () => void;
  onEdit: (index: number, url: string) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, to: BucketId) => void;
}) {
  return (
    <section className={`rounded-xl border bg-paper p-3 ${links.length > 0 ? "border-accent" : "border-line"}`}>
      <h3 className="text-base font-semibold">{bucketHeading(id, links.length)}</h3>
      <label className="mt-3 block">
        <span className="sr-only">Paste links for {bucketHeading(id, links.length)}</span>
        <textarea
          value={paste}
          onChange={(event) => onPaste(event.target.value)}
          rows={2}
          placeholder="Ek line pe ek link. https://www.instagram.com/reel/…"
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex h-11 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold text-paper"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add links
        </button>
        {note ? <p className="text-right text-sm text-muted">{note}</p> : null}
      </div>
      {links.length > 0 ? (
        <ol className="mt-3 flex flex-col gap-2">
          {links.map((url, index) => {
            const code = shortcode(url);
            const repeated = code ? dupes.has(code) : false;
            return (
              <li key={`${id}-${index}`} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2 sm:flex-row sm:items-center">
                <span className="w-7 shrink-0 text-sm font-semibold tabular-nums text-muted">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <input
                    value={url}
                    onChange={(event) => onEdit(index, event.target.value)}
                    aria-label={`Link ${index + 1}`}
                    className="h-11 w-full rounded-lg border border-line bg-paper px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  {repeated ? <p className="mt-1 text-xs text-accent">Duplicate reel</p> : null}
                  {!repeated && url.trim() && !isInstagramUrl(url) ? (
                    <p className="mt-1 text-xs text-muted">Instagram link nahi lag raha</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <select
                    aria-label={`Move link ${index + 1}`}
                    value=""
                    onChange={(event) => {
                      const to = event.target.value as BucketId;
                      if (to) onMove(index, to);
                    }}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 text-sm sm:w-36 sm:flex-none"
                  >
                    <option value="">Move</option>
                    {BUCKETS.filter((def) => def.id !== id).map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.short}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Remove link ${index + 1}`}
                    onClick={() => onRemove(index)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line bg-paper"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function Paper({ blocks }: { blocks: Block[] }) {
  return (
    <article className="rounded-xl border border-line bg-paper p-5 shadow-md sm:p-8">
      {blocks.map((block, index) => {
        if (block.type === "gap") return <div key={index} className="h-3" />;
        if (block.type === "title") {
          return (
            <h2 key={index} className="text-2xl font-semibold tracking-tight">
              {block.text}
            </h2>
          );
        }
        if (block.type === "campaign") {
          return (
            <p key={index} className="mt-2 text-lg font-semibold">
              {block.text}
            </p>
          );
        }
        if (block.type === "intro") {
          return (
            <p key={index} className="mt-2 text-base">
              {block.text}
            </p>
          );
        }
        if (block.type === "group") {
          return (
            <h3 key={index} className="text-lg font-semibold">
              {block.text}
            </h3>
          );
        }
        if (block.type === "section") {
          return (
            <p key={index} className="text-base font-semibold">
              {block.text}
            </p>
          );
        }
        if (block.type !== "table") return null;
        return (
          <div key={index} className="overflow-x-auto">
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-16 border border-line bg-surface px-2 py-1 text-left font-semibold">Sr no</th>
                  <th className="border border-line bg-surface px-2 py-1 text-left font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => (
                  <tr key={`${row.n}-${row.url}`}>
                    <td className="border border-line px-2 py-1 align-top tabular-nums">{row.n}</td>
                    <td className="border border-line px-2 py-1">
                      <a href={row.url} target="_blank" rel="noreferrer" className="break-all text-accent underline">
                        {row.url}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </article>
  );
}

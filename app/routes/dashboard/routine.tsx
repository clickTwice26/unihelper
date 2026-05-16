import { useEffect, useRef, useState } from "react";
import { Form, useFetcher, useLoaderData, useNavigation } from "react-router";
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Copy,
  EyeOff,
  GripVertical,
  MapPin,
  Moon,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import type { Route } from "./+types/routine";

export function meta() {
  return [{ title: "Weekly Routine | UniBuddy" }];
}

// ── Types ─────────────────────────────────────────────────────────────────────

type RoutineEntry = {
  id: string;
  dayOfWeek: number;
  courseName: string;
  room: string | null;
  startTime: string;
  endTime: string;
  color: string;
};

type CourseOption = { id: string; title: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = [
  { label: "Sunday",    short: "Sun", value: 0 },
  { label: "Monday",    short: "Mon", value: 1 },
  { label: "Tuesday",   short: "Tue", value: 2 },
  { label: "Wednesday", short: "Wed", value: 3 },
  { label: "Thursday",  short: "Thu", value: 4 },
  { label: "Saturday",  short: "Sat", value: 6 },
];

const COLORS: { id: string; label: string; bg: string; border: string; text: string; dot: string; ring: string }[] = [
  { id: "indigo",  label: "Indigo",  bg: "bg-indigo-50",  border: "border-indigo-200",  text: "text-indigo-800",  dot: "bg-indigo-500",  ring: "ring-indigo-400"  },
  { id: "sky",     label: "Sky",     bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-800",     dot: "bg-sky-500",     ring: "ring-sky-400"     },
  { id: "emerald", label: "Emerald", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", dot: "bg-emerald-500", ring: "ring-emerald-400" },
  { id: "amber",   label: "Amber",   bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-800",   dot: "bg-amber-500",   ring: "ring-amber-400"   },
  { id: "rose",    label: "Rose",    bg: "bg-rose-50",    border: "border-rose-200",     text: "text-rose-800",    dot: "bg-rose-500",    ring: "ring-rose-400"    },
  { id: "violet",  label: "Violet",  bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-800",  dot: "bg-violet-500",  ring: "ring-violet-400"  },
  { id: "orange",  label: "Orange",  bg: "bg-orange-50",  border: "border-orange-200",  text: "text-orange-800",  dot: "bg-orange-500",  ring: "ring-orange-400"  },
  { id: "teal",    label: "Teal",    bg: "bg-teal-50",    border: "border-teal-200",    text: "text-teal-800",    dot: "bg-teal-500",    ring: "ring-teal-400"    },
];

function getColor(id: string) {
  return COLORS.find((c) => c.id === id) ?? COLORS[0];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw redirect("/login");

  const [entries, courses] = await Promise.all([
    db.classRoutine.findMany({
      where: { userId: session.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      select: { id: true, dayOfWeek: true, courseName: true, room: true, startTime: true, endTime: true, color: true },
    }),
    db.course.findMany({
      where: { ownerId: session.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return { entries, courses };
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function action({ request }: Route.ActionArgs) {
  const { getAuthenticatedUser } = await import("~/lib/auth.server");
  const { redirect } = await import("react-router");
  const { db } = await import("~/lib/db.server");
  const { rateLimit } = await import("~/lib/ratelimit.server");
  const { serializeFlash } = await import("~/lib/flash.server");

  const session = await getAuthenticatedUser(request);
  if (!session) throw new Response("Unauthorized", { status: 401 });

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "").trim();

  const headers = new Headers();
  const flash = async (type: "success" | "error", message: string) => {
    headers.append("Set-Cookie", await serializeFlash({ type, message }));
    return redirect("/dashboard/routine", { headers });
  };

  try {
    await rateLimit({ key: `routine:${intent}:${session.id}`, limit: 60, windowSec: 3600 });
  } catch (err) {
    if (err instanceof Response && err.status === 429)
      throw await flash("error", "Too many requests. Please wait.");
    throw err;
  }

  if (intent === "create") {
    const dayOfWeek = parseInt(String(formData.get("dayOfWeek") ?? ""), 10);
    const courseName = String(formData.get("courseName") ?? "").trim().slice(0, 200);
    const room = String(formData.get("room") ?? "").trim().slice(0, 100) || null;
    const startTime = String(formData.get("startTime") ?? "").trim();
    const endTime = String(formData.get("endTime") ?? "").trim();
    const color = String(formData.get("color") ?? "indigo").trim();

    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)
      throw await flash("error", "Invalid day.");
    if (!courseName) throw await flash("error", "Course name is required.");
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime))
      throw await flash("error", "Invalid time format.");
    if (timeToMins(startTime) >= timeToMins(endTime))
      throw await flash("error", "End time must be after start time.");
    if (!COLORS.find((c) => c.id === color))
      throw await flash("error", "Invalid color.");

    const existing = await db.classRoutine.count({ where: { userId: session.id } });
    if (existing >= 50) throw await flash("error", "Maximum 50 entries per routine.");

    await db.classRoutine.create({
      data: { userId: session.id, dayOfWeek, courseName, room, startTime, endTime, color },
    });
    throw await flash("success", `"${courseName}" added to ${DAYS[dayOfWeek].label}.`);
  }

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) throw await flash("error", "Missing ID.");
    const entry = await db.classRoutine.findUnique({ where: { id }, select: { userId: true } });
    if (!entry || entry.userId !== session.id) throw await flash("error", "Entry not found.");
    await db.classRoutine.delete({ where: { id } });
    throw await flash("success", "Class removed.");
  }

  if (intent === "move") {
    const id = String(formData.get("id") ?? "").trim();
    const dayOfWeek = parseInt(String(formData.get("dayOfWeek") ?? ""), 10);
    if (!id) throw await flash("error", "Missing ID.");
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)
      throw await flash("error", "Invalid day.");
    const entry = await db.classRoutine.findUnique({ where: { id }, select: { userId: true, dayOfWeek: true } });
    if (!entry || entry.userId !== session.id) throw await flash("error", "Entry not found.");
    if (entry.dayOfWeek === dayOfWeek) throw redirect("/dashboard/routine", { headers });
    await db.classRoutine.update({ where: { id }, data: { dayOfWeek } });
    throw await flash("success", "Class moved.");
  }

  if (intent === "copy") {
    const id = String(formData.get("id") ?? "").trim();
    const dayOfWeek = parseInt(String(formData.get("dayOfWeek") ?? ""), 10);
    if (!id) throw await flash("error", "Missing ID.");
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)
      throw await flash("error", "Invalid day.");
    const entry = await db.classRoutine.findUnique({
      where: { id },
      select: { userId: true, courseName: true, room: true, startTime: true, endTime: true, color: true },
    });
    if (!entry || entry.userId !== session.id) throw await flash("error", "Entry not found.");
    const existing = await db.classRoutine.count({ where: { userId: session.id } });
    if (existing >= 50) throw await flash("error", "Maximum 50 entries per routine.");
    await db.classRoutine.create({
      data: {
        userId: session.id,
        dayOfWeek,
        courseName: entry.courseName,
        room: entry.room,
        startTime: entry.startTime,
        endTime: entry.endTime,
        color: entry.color,
      },
    });
    throw await flash("success", "Class copied.");
  }

  throw new Response("Unknown intent", { status: 400 });
}

// ── Custom Course Select ──────────────────────────────────────────────────────

function CourseSelect({
  courses,
  value,
  onChange,
}: {
  courses: CourseOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const options = [
    { label: "Pick from my courses…", value: "" },
    ...courses.map((c) => ({ label: c.title, value: c.title })),
  ];
  const displayLabel = value
    ? (options.find((o) => o.value === value)?.label ?? value)
    : "Pick from my courses…";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm text-left transition
          ${open ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300"}
          ${value ? "text-slate-900" : "text-slate-400"}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={15}
          className={`ml-2 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition hover:bg-indigo-50
                ${opt.value === value ? "text-indigo-700 font-semibold" : opt.value === "" ? "text-slate-400" : "text-slate-800"}`}
            >
              {opt.value === value && <Check size={13} className="shrink-0 text-indigo-600" />}
              {opt.value !== value && <span className="w-[13px] shrink-0" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Class Modal ───────────────────────────────────────────────────────────

function AddClassModal({
  courses,
  isSubmitting,
  defaultDay,
  onClose,
}: {
  courses: CourseOption[];
  isSubmitting: boolean;
  defaultDay: number;
  onClose: () => void;
}) {
  const [selectedColor, setSelectedColor] = useState("indigo");
  const [selectedDay, setSelectedDay] = useState(defaultDay);
  const [courseName, setCourseName] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Add Class to Routine</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          <Form method="post" preventScrollReset className="space-y-4 px-6 py-5">
            <input type="hidden" name="intent" value="create" />
            {/* hidden so form submission always has the right value */}
            <input type="hidden" name="dayOfWeek" value={selectedDay} />

            {/* Day pill selector */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Day <span className="text-red-500">*</span>
              </p>
              <div className="grid grid-cols-6 gap-1">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setSelectedDay(d.value)}
                    className={`rounded-lg py-2 text-center text-xs font-bold ring-1 transition
                      ${selectedDay === d.value
                        ? "bg-indigo-600 text-white ring-indigo-600 shadow-sm"
                        : "text-slate-600 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
                      }
                      ${d.value === 0 || d.value === 6 ? "text-rose-500 ring-rose-200 hover:bg-rose-50" : ""}
                      ${selectedDay === d.value ? "!text-white !ring-indigo-600 !bg-indigo-600" : ""}
                    `}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Course name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Course Name <span className="text-red-500">*</span>
              </label>
              {courses.length > 0 ? (
                <div className="space-y-2">
                  <CourseSelect
                    courses={courses}
                    value={courseName}
                    onChange={(v) => setCourseName(v)}
                  />
                  <input
                    type="text"
                    name="courseName"
                    required
                    maxLength={200}
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Or type a custom name…"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  name="courseName"
                  required
                  maxLength={200}
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Software Engineering"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              )}
            </div>

            {/* Time row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="startTime"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  name="endTime"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            {/* Room */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Room / Location</label>
              <input
                type="text"
                name="room"
                maxLength={100}
                placeholder="e.g. Room 301, Lab B…"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    name="color"
                    onClick={() => setSelectedColor(c.id)}
                    title={c.label}
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition ${c.dot}
                      ${selectedColor === c.id
                        ? `ring-2 ring-offset-2 ${c.ring} scale-110`
                        : "opacity-60 hover:opacity-100"
                      }`}
                  >
                    {selectedColor === c.id && <Check size={12} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
              {/* hidden input carries the color value */}
              <input type="hidden" name="color" value={selectedColor} />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isSubmitting ? "Adding…" : "Add Class"}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoutinePage() {
  const { entries, courses } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const fetcher = useFetcher();

  const [showModal, setShowModal] = useState(false);
  const [defaultDay, setDefaultDay] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [offDays, setOffDays] = useState<number[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("routine_off_days");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showOffDaysPicker, setShowOffDaysPicker] = useState(false);
  const offDaysPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("routine_off_days", JSON.stringify(offDays));
  }, [offDays]);

  useEffect(() => {
    if (!showOffDaysPicker) return;
    function handler(e: MouseEvent) {
      if (offDaysPickerRef.current && !offDaysPickerRef.current.contains(e.target as Node))
        setShowOffDaysPicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showOffDaysPicker]);

  function toggleOffDay(val: number) {
    setOffDays((prev) =>
      prev.includes(val) ? prev.filter((d) => d !== val) : [...prev, val]
    );
  }

  const visibleDays = DAYS.filter((d) => !offDays.includes(d.value));

  // Group entries by day
  const byDay = DAYS.map((d) =>
    (entries as RoutineEntry[])
      .filter((e) => e.dayOfWeek === d.value)
      .sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime))
  );

  const totalClasses = (entries as RoutineEntry[]).length;
  const activeDays = byDay.filter((d) => d.length > 0).length;

  function openModalFor(day: number) {
    setDefaultDay(day);
    setShowModal(true);
  }

  function handleDrop(e: React.DragEvent, targetDay: number) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const copy = e.altKey;
    setDraggingEntryId(null);
    setDragOverDay(null);
    setIsCopyMode(false);
    if (!id) return;
    const draggedEntry = (entries as RoutineEntry[]).find((en) => en.id === id);
    if (!draggedEntry) return;
    if (!copy && draggedEntry.dayOfWeek === targetDay) return;
    const fd = new FormData();
    fd.append("intent", copy ? "copy" : "move");
    fd.append("id", id);
    fd.append("dayOfWeek", String(targetDay));
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <>
      {/* Add modal */}
      {showModal && (
        <AddClassModal
          courses={courses as CourseOption[]}
          isSubmitting={isSubmitting}
          defaultDay={defaultDay}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="space-y-5">
        {/* Page header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {totalClasses} {totalClasses === 1 ? "class" : "classes"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {activeDays} {activeDays === 1 ? "day" : "days"} active
              </span>
              {offDays.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600 ring-1 ring-amber-200">
                  <Moon size={11} />
                  {offDays.length} off
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Off days picker */}
            <div ref={offDaysPickerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowOffDaysPicker((o) => !o)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition
                  ${
                    offDays.length > 0
                      ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  }`}
              >
                <EyeOff size={15} />
                Off Days
                {offDays.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {offDays.length}
                  </span>
                )}
              </button>

              {showOffDaysPicker && (
                <div className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Off Days</p>
                    <button
                      type="button"
                      onClick={() => setShowOffDaysPicker(false)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-slate-500">
                    Selected days are hidden from your routine grid.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => {
                      const isOff = offDays.includes(d.value);
                      const isWeekend = d.value === 0 || d.value === 6;
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleOffDay(d.value)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition
                            ${
                              isOff
                                ? "bg-amber-500 text-white ring-amber-500 shadow-sm"
                                : isWeekend
                                  ? "bg-rose-50 text-rose-600 ring-rose-200 hover:bg-rose-100"
                                  : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100"
                            }`}
                        >
                          {isOff ? <Moon size={13} /> : <Check size={13} className="opacity-0" />}
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  {offDays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOffDays([])}
                      className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      Show all days
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => openModalFor(1)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 sm:px-4 sm:py-2.5"
            >
              <Plus size={15} />
              <span>Add Class</span>
            </button>
          </div>
        </div>

        {/* Weekly grid — scrolls horizontally on small screens */}
        <div className="-mx-1 overflow-x-auto pb-1">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${visibleDays.length || 1}, minmax(160px, 1fr))` }}
        >
          {visibleDays.map((day) => {
            const dayIdx = DAYS.findIndex((d) => d.value === day.value);
            const dayEntries = byDay[dayIdx];
            const isWeekend = day.value === 0 || day.value === 6;
            const isDragOver = dragOverDay === day.value && draggingEntryId !== null;
            return (
              <div
                key={day.value}
                className={`flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-all
                  ${isDragOver
                    ? isCopyMode
                      ? "border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-300/50"
                      : "border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-300/50"
                    : "border-slate-200 bg-white"
                  }`}
                onDragOver={(e) => {
                  if (!draggingEntryId) return;
                  e.preventDefault();
                  const copy = e.altKey;
                  e.dataTransfer.dropEffect = copy ? "copy" : "move";
                  setIsCopyMode(copy);
                  setDragOverDay(day.value);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setDragOverDay(null);
                }}
                onDrop={(e) => handleDrop(e, day.value)}
              >
                {/* Day header */}
                <div
                  className={`flex items-center justify-between border-b px-4 py-3 ${
                    isDragOver
                      ? isCopyMode
                        ? "border-emerald-200 bg-emerald-50/80"
                        : "border-indigo-200 bg-indigo-50/80"
                      : isWeekend
                        ? "border-rose-100 bg-rose-50/60"
                        : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${isWeekend && !isDragOver ? "text-rose-500" : isDragOver ? (isCopyMode ? "text-emerald-600" : "text-indigo-600") : "text-slate-400"}`}>
                      {day.short}
                      {isDragOver && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none
                          bg-current/10">
                          {isCopyMode ? <Copy size={9} /> : null}
                          {isCopyMode ? "copy" : "move here"}
                        </span>
                      )}
                    </p>
                    <p className="text-sm font-bold text-slate-800">{day.label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openModalFor(day.value)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-indigo-600 hover:shadow-sm"
                    title={`Add class to ${day.label}`}
                  >
                    <Plus size={15} />
                  </button>
                </div>

                {/* Entries */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {dayEntries.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => openModalFor(day.value)}
                      className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 py-8 transition hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      <Plus size={18} className="text-slate-300 transition group-hover:text-indigo-400" />
                      <span className="text-xs font-medium text-slate-300 transition group-hover:text-indigo-400">
                        Add class
                      </span>
                    </button>
                  ) : (
                    dayEntries.map((entry) => {
                      const c = getColor(entry.color);
                      const isDeleting =
                        isSubmitting &&
                        String(navigation.formData?.get("intent")) === "delete" &&
                        String(navigation.formData?.get("id")) === entry.id;
                      const isDraggingThis = draggingEntryId === entry.id;

                      return (
                        <div
                          key={entry.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copyMove";
                            e.dataTransfer.setData("text/plain", entry.id);
                            setDraggingEntryId(entry.id);
                            setDeleteConfirmId(null);
                          }}
                          onDragEnd={() => {
                            setDraggingEntryId(null);
                            setDragOverDay(null);
                            setIsCopyMode(false);
                          }}
                          className={`group relative rounded-xl border p-3 transition cursor-grab active:cursor-grabbing select-none
                            ${c.bg} ${c.border}
                            ${isDraggingThis ? "opacity-40 scale-[0.97]" : ""}
                          `}
                        >
                          {/* Grip handle */}
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 transition pointer-events-none">
                            <GripVertical size={13} />
                          </span>
                          {/* Color stripe */}
                          <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${c.dot}`} />

                          <div className="pl-3">
                            <div className="flex items-start justify-between gap-1">
                              <p className={`text-sm font-bold leading-snug ${c.text}`}>
                                {entry.courseName}
                              </p>
                              {/* Delete button */}
                              {deleteConfirmId === entry.id ? (
                                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-white/80"
                                  >
                                    No
                                  </button>
                                  <Form method="post" preventScrollReset>
                                    <input type="hidden" name="intent" value="delete" />
                                    <input type="hidden" name="id" value={entry.id} />
                                    <button
                                      type="submit"
                                      disabled={isDeleting}
                                      className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                                    >
                                      {isDeleting ? "…" : "Yes"}
                                    </button>
                                  </Form>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(entry.id)}
                                  className="shrink-0 rounded p-1 text-transparent transition group-hover:text-slate-400 hover:!text-red-500 hover:bg-white/70"
                                  title="Remove"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.text} opacity-80`}>
                                <Clock size={11} />
                                {fmtTime(entry.startTime)} – {fmtTime(entry.endTime)}
                              </span>
                              {entry.room && (
                                <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.text} opacity-70`}>
                                  <MapPin size={11} />
                                  {entry.room}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>{/* end overflow-x-auto */}

        {/* Empty state */}
        {totalClasses === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-center shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <BookOpen size={26} />
            </div>
            <p className="mt-4 text-sm font-bold text-slate-700">No classes added yet</p>
            <p className="mt-1 text-sm text-slate-400">
              Click "Add Class" to start building your weekly routine.
            </p>
            <button
              type="button"
              onClick={() => openModalFor(1)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Plus size={15} />
              Add First Class
            </button>
          </div>
        )}

        {/* Color legend */}
        {totalClasses > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Color Tags</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <span
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${c.bg} ${c.border} ${c.text}`}
                >
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  {c.label}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              <GripVertical size={11} className="inline mr-0.5 -mt-0.5" />
              Drag a class to move it · Hold <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500">Alt</kbd> while dropping to copy
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteErrorBoundary";

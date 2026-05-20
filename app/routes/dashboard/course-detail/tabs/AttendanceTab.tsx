import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import { Check, ClipboardCheck, Clock, Lock, User, X } from "lucide-react";

import type { AttendanceState } from "../types";

function todayDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Returns true if the class date is more than 2 days in the past (attendance locked). */
function isAttendanceLocked(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const classDate = new Date(y, m - 1, d);
  const cutoff = new Date(classDate);
  cutoff.setDate(cutoff.getDate() + 2);
  cutoff.setHours(23, 59, 59, 999);
  return Date.now() > cutoff.getTime();
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDateParts(dateKey: string): { dayAbbr: string; formatted: string } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    dayAbbr: DAY_ABBR[dt.getDay()],
    formatted: dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
}

function getState(
  dateKey: string,
  map: Record<string, { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }>,
): AttendanceState {
  const rec = map[dateKey];
  if (!rec) return "unset";
  if (rec.status === "ABSENT") return "absent";
  if (rec.timing === "LATE") return "late";
  return "present";
}

export function AttendanceTab({
  courseId,
  courseTitle,
  classDates,
  hasRoutine,
  attendanceMap,
  buddyAttendanceMap = {},
  buddyDisplayName = null,
  navigation,
}: {
  courseId: string;
  courseTitle: string;
  classDates: string[];
  hasRoutine: boolean;
  attendanceMap: Record<string, { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }>;
  buddyAttendanceMap?: Record<string, { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }>;
  buddyDisplayName?: string | null;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const isSubmitting = navigation.state === "submitting";
  const submittingDate = String(navigation.formData?.get("date") ?? "");
  const submittingState = String(navigation.formData?.get("attendanceState") ?? "");
  const todayKey = todayDateKey();
  const todayRef = useRef<HTMLDivElement>(null);

  // Scroll to today's row on mount
  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Stats only count past + today (can't attend future classes)
  const pastDates = classDates.filter((d) => d <= todayKey);
  const total = pastDates.length;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  for (const d of pastDates) {
    const s = getState(d, attendanceMap);
    if (s === "present") presentCount++;
    else if (s === "late") {
      presentCount++;
      lateCount++;
    } else absentCount++; // absent or unset (not recorded) both count as absent
  }
  const attendedCount = presentCount;
  const attendancePct = total > 0 ? Math.round((attendedCount / total) * 100) : 0;
  const upcomingCount = classDates.filter((d) => d > todayKey).length;

  // Buddy stats (read-only, past dates only)
  const hasBuddy = buddyDisplayName !== null && buddyDisplayName !== undefined;
  let buddyPresent = 0;
  let buddyLate = 0;
  let buddyAbsent = 0;
  if (hasBuddy) {
    for (const d of pastDates) {
      const s = getState(d, buddyAttendanceMap);
      if (s === "present") buddyPresent++;
      else if (s === "late") {
        buddyPresent++;
        buddyLate++;
      } else buddyAbsent++; // absent or unset both count as absent
    }
  }
  const buddyPct = total > 0 ? Math.round((buddyPresent / total) * 100) : 0;

  if (!hasRoutine) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <ClipboardCheck size={22} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          No routine found for this course
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Add <span className="font-semibold">&ldquo;{courseTitle}&rdquo;</span> to your Weekly
          Routine to enable attendance tracking. The schedule is auto-calculated from your routine.
        </p>
      </div>
    );
  }

  if (classDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <ClipboardCheck size={22} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">No class sessions yet</p>
        <p className="mt-1 text-sm text-slate-400">
          Class dates will appear here once sessions are scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 sm:px-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Attendance Overview</h3>
            <p className="text-xs text-slate-500">Summary is based on past and current class sessions.</p>
          </div>
          {upcomingCount > 0 && (
            <p className="text-xs text-slate-500">
              {upcomingCount} upcoming class{upcomingCount !== 1 ? "es" : ""} scheduled
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Classes</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{total}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Present</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{attendedCount}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500">Absent</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{absentCount}</p>
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Rate</p>
            <p className="mt-1 text-2xl font-bold text-indigo-700">{attendancePct}%</p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">Attendance Rate</span>
              <span>
                {attendedCount} / {total} classes
                {lateCount > 0 && <span className="ml-1.5 text-amber-500">({lateCount} late)</span>}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  attendancePct >= 75
                    ? "bg-emerald-500"
                    : attendancePct >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${attendancePct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {hasBuddy && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <User size={14} className="text-indigo-500" />
            <p className="text-xs font-semibold text-slate-700">
              {buddyDisplayName || "Your Buddy"}&rsquo;s Attendance
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-slate-800">{buddyPresent}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Present</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-amber-600">{buddyLate}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-500">Late</p>
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-center">
              <p className="text-lg font-bold text-red-500">{buddyAbsent}</p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-red-400">Absent</p>
            </div>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-center">
              <p
                className={`text-lg font-bold ${
                  buddyPct >= 75 ? "text-emerald-600" : buddyPct >= 50 ? "text-amber-600" : "text-red-600"
                }`}
              >
                {buddyPct}%
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wide text-indigo-400">Rate</p>
            </div>
          </div>
          {total > 0 && (
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    buddyPct >= 75 ? "bg-emerald-500" : buddyPct >= 50 ? "bg-amber-400" : "bg-red-500"
                  }`}
                  style={{ width: `${buddyPct}%` }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Class Sessions</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Present (on time)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              Late
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Absent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              Not recorded
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
        {classDates.map((dateKey) => {
          const { dayAbbr, formatted } = localDateParts(dateKey);
          const current = getState(dateKey, attendanceMap);
          const buddyState = hasBuddy ? getState(dateKey, buddyAttendanceMap) : null;
          const isPending = isSubmitting && submittingDate === dateKey;
          const isToday = dateKey === todayKey;
          const isFuture = dateKey > todayKey;
          const locked = !isFuture && isAttendanceLocked(dateKey);

          return (
            <div
              key={dateKey}
              ref={isToday ? todayRef : undefined}
              className={`flex flex-col gap-3 rounded-xl border px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between ${
                isToday
                  ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                  : isFuture
                    ? "border-slate-200 bg-slate-50 opacity-70"
                    : locked
                      ? "border-slate-200 bg-slate-50"
                      : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg ${
                  isToday ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  <span className="text-[10px] font-semibold uppercase leading-none">{dayAbbr}</span>
                  <span className="mt-0.5 text-sm font-bold leading-none">{dateKey.slice(8)}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{formatted}</p>
                    {isToday && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">Today</span>
                    )}
                    {isFuture && (
                      <span className="rounded-full border border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-400">Upcoming</span>
                    )}
                    {locked && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        <Lock size={9} />
                        Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{dayAbbr}day class</p>
                </div>
              </div>

              {buddyState !== null && (
                <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                  <User size={10} className="shrink-0 text-slate-400" />
                  <span className="text-[10px] font-medium text-slate-400 mr-0.5">
                    {buddyDisplayName?.split(" ")[0] ?? "Buddy"}:
                  </span>
                  {buddyState === "present" && <span className="text-[10px] font-semibold text-emerald-600">Present</span>}
                  {buddyState === "late" && <span className="text-[10px] font-semibold text-amber-500">Late</span>}
                  {buddyState === "absent" && <span className="text-[10px] font-semibold text-red-500">Absent</span>}
                  {buddyState === "unset" && <span className="text-[10px] font-medium text-slate-400">—</span>}
                </div>
              )}

              {locked ? (
                <div className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                  <Lock size={12} />
                  {current === "present" && <span className="font-medium text-emerald-600">Present</span>}
                  {current === "late" && <span className="font-medium text-amber-600">Late</span>}
                  {(current === "absent" || current === "unset") && <span className="font-medium text-red-500">Absent</span>}
                </div>
              ) : (
                <Form method="post" preventScrollReset className="flex shrink-0 items-center gap-1.5">
                  <input type="hidden" name="intent" value="upsert-attendance" />
                  <input type="hidden" name="date" value={dateKey} />
                  <input
                    type="hidden"
                    name="backHref"
                    value={`/dashboard/courses/${courseId}?tab=attendance`}
                  />

                  <button
                    type="submit"
                    name="attendanceState"
                    value="present"
                    disabled={isPending || isFuture}
                    title="Mark Present (on time)"
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      current === "present"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  >
                    {isPending && submittingState === "present" ? (
                      "..."
                    ) : (
                      <>
                        <Check size={11} />
                        Present
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    name="attendanceState"
                    value="late"
                    disabled={isPending || isFuture}
                    title="Mark Late"
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      current === "late"
                        ? "bg-amber-400 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                    }`}
                  >
                    {isPending && submittingState === "late" ? (
                      "..."
                    ) : (
                      <>
                        <Clock size={11} />
                        Late
                      </>
                    )}
                  </button>

                  <button
                    type="submit"
                    name="attendanceState"
                    value="absent"
                    disabled={isPending || isFuture}
                    title="Mark Absent"
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      current === "absent"
                        ? "bg-red-500 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    }`}
                  >
                    {isPending && submittingState === "absent" ? (
                      "..."
                    ) : (
                      <>
                        <X size={11} />
                        Absent
                      </>
                    )}
                  </button>
                </Form>
              )}
            </div>
          );
        })}
        </div>
      </section>
    </div>
  );
}

import { Form, useNavigation } from "react-router";
import { Check, ClipboardCheck, Clock, X } from "lucide-react";

import type { AttendanceState } from "../types";

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
  navigation,
}: {
  courseId: string;
  courseTitle: string;
  classDates: string[];
  hasRoutine: boolean;
  attendanceMap: Record<string, { status: "PRESENT" | "ABSENT"; timing: "ON_TIME" | "LATE" }>;
  navigation: ReturnType<typeof useNavigation>;
}) {
  const isSubmitting = navigation.state === "submitting";
  const submittingDate = String(navigation.formData?.get("date") ?? "");
  const submittingState = String(navigation.formData?.get("attendanceState") ?? "");

  // Compute stats
  const total = classDates.length;
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  for (const d of classDates) {
    const s = getState(d, attendanceMap);
    if (s === "present") presentCount++;
    else if (s === "late") {
      presentCount++;
      lateCount++;
    } else if (s === "absent") absentCount++;
  }
  const attendedCount = presentCount;
  const attendancePct = total > 0 ? Math.round((attendedCount / total) * 100) : 0;

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
    <div className="px-6 py-5 space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
          <p className="text-xl font-bold text-slate-800">{total}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
            Total Classes
          </p>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center shadow-sm">
          <p className="text-xl font-bold text-emerald-700">{attendedCount}</p>
          <p className="mt-0.5 text-xs font-medium text-emerald-500 uppercase tracking-wide">
            Present
          </p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-center shadow-sm">
          <p className="text-xl font-bold text-red-600">{absentCount}</p>
          <p className="mt-0.5 text-xs font-medium text-red-400 uppercase tracking-wide">Absent</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-center shadow-sm">
          <p className="text-xl font-bold text-indigo-700">{attendancePct}%</p>
          <p className="mt-0.5 text-xs font-medium text-indigo-400 uppercase tracking-wide">
            Attendance
          </p>
        </div>
      </div>

      {/* Attendance bar */}
      {total > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">Attendance Rate</span>
            <span>
              {attendedCount} / {total} classes
              {lateCount > 0 && (
                <span className="ml-1.5 text-amber-500">({lateCount} late)</span>
              )}
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

      {/* Legend */}
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

      {/* Attendance rows */}
      <div className="flex flex-col gap-2">
        {classDates.map((dateKey) => {
          const { dayAbbr, formatted } = localDateParts(dateKey);
          const current = getState(dateKey, attendanceMap);
          const isPending = isSubmitting && submittingDate === dateKey;

          return (
            <div
              key={dateKey}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Date info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <span className="text-[10px] font-semibold uppercase leading-none">{dayAbbr}</span>
                  <span className="mt-0.5 text-sm font-bold leading-none">{dateKey.slice(8)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{formatted}</p>
                  <p className="text-xs text-slate-400">{dayAbbr}day class</p>
                </div>
              </div>

              {/* Toggle buttons */}
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
                  disabled={isPending}
                  title="Mark Present (on time)"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    current === "present"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  {isPending && submittingState === "present" ? (
                    "…"
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
                  disabled={isPending}
                  title="Mark Late"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    current === "late"
                      ? "bg-amber-400 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                  }`}
                >
                  {isPending && submittingState === "late" ? (
                    "…"
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
                  disabled={isPending}
                  title="Mark Absent"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                    current === "absent"
                      ? "bg-red-500 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  {isPending && submittingState === "absent" ? (
                    "…"
                  ) : (
                    <>
                      <X size={11} />
                      Absent
                    </>
                  )}
                </button>
              </Form>
            </div>
          );
        })}
      </div>
    </div>
  );
}

# Warden — Active Accountability Guard

## Purpose

Warden is **not** a static guidelines page.  
It is an active, living guard that watches every academic event on the user's calendar and continuously asks one question:

> **"Have you done what you're supposed to do — right now?"**

It knows every upcoming quiz, assignment, mid exam, final exam, and presentation. For each one it checks whether the user has actually taken the required preparation action. If not, it raises an alert that stays open until the user acts or the event passes.

The mental model: imagine a strict academic supervisor who has a checklist for every item on your timetable, ticks items off only when you demonstrate action, and immediately flags anything you're ignoring.

---

## The Rules

These rules are absolute. There is no "guidelines" framing — they are requirements the Warden enforces.

| Event Kind   | Preparation Required                         | Alert Window   |
|--------------|----------------------------------------------|----------------|
| Quiz         | Complete at least one mock quiz              | 3 days before  |
| Mid Exam     | Complete at least one mock mid exam          | 1 week before  |
| Final Exam   | Complete at least one mock final exam        | 1 week before  |
| Assignment   | Mark assignment as submitted/done            | 3 days before  |
| Presentation | Mark slides as ready                         | 7 days before  |

**Key distinction**: Presentation is the only event where no mock test is required. The deliverable is "slides ready" — a concrete artefact, not a practice run.

---

## Compliance Lifecycle

Each event tracked by Warden moves through three states:

```
UPCOMING  ──(enters alert window)──▶  ALERT  ──(user logs action)──▶  COMPLIANT
                                         │
                                 (event date passes
                                  with no action)
                                         │
                                         ▼
                                      MISSED
```

### State Descriptions

- **UPCOMING**: Event is known but not yet within the alert window. Warden does not show it.
- **ALERT**: Event is within the window AND the required preparation action has not been logged. Warden shows a red or amber card.
- **COMPLIANT**: User has logged the required action for this event. Warden shows a green "done" state (or removes the card from the active list).
- **MISSED**: Alert window passed, event date passed, and no action was ever logged. Warden marks this for the record but cannot do anything about it.

---

## Required Actions Per Kind

### Quiz — "Mock Quiz Logged"
- User must open the quiz record and click **"Log Mock Attempt"**
- A `QuizMockLog` record is created: `{ quizId, userId, loggedAt }`
- Once one log exists for that quiz → compliance = true

### Mid Exam — "Mock Mid Exam Logged"
- User must open the mid exam record and click **"Log Mock Exam"**
- A `MidExamMockLog` record is created: `{ midExamId, userId, loggedAt }`
- Once one log exists → compliance = true

### Final Exam — "Mock Final Exam Logged"
- Same pattern as Mid Exam
- A `FinalExamMockLog` record: `{ finalExamId, userId, loggedAt }`

### Assignment — "Submitted"
- Assignment already has a `deadline` field
- Add a boolean `submitted` flag to the `Assignment` model
- User marks assignment as submitted → `submitted = true`
- Warden checks: if within 3-day window and `submitted === false` → alert

### Presentation — "Slides Ready"
- Presentation already exists in the DB
- Add a boolean `slidesReady` flag to the `Presentation` model
- User marks slides as ready in the presentation tab
- Warden checks: if within 7-day window and `slidesReady === false` → alert

---

## Data Model Changes Required

```prisma
// New tables
model QuizMockLog {
  id        String   @id @default(cuid())
  quizId    String
  userId    String
  loggedAt  DateTime @default(now())
  quiz      Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([quizId, userId])   // one log per user per quiz is enough to satisfy compliance
}

model MidExamMockLog {
  id         String   @id @default(cuid())
  midExamId  String
  userId     String
  loggedAt   DateTime @default(now())
  midExam    MidExam  @relation(fields: [midExamId], references: [id], onDelete: Cascade)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([midExamId, userId])
}

model FinalExamMockLog {
  id           String    @id @default(cuid())
  finalExamId  String
  userId       String
  loggedAt     DateTime  @default(now())
  finalExam    FinalExam @relation(fields: [finalExamId], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([finalExamId, userId])
}

// Fields to add to existing models
model Assignment {
  // ... existing fields ...
  submitted    Boolean  @default(false)
  submittedAt  DateTime?
}

model Presentation {
  // ... existing fields ...
  slidesReady    Boolean  @default(false)
  slidesReadyAt  DateTime?
}
```

---

## Warden Page Behaviour

### Active Alerts Section
- Queries all events within alert windows for the current user
- For each event, queries its compliance log (or `submitted`/`slidesReady` flag)
- **Only non-compliant events appear in alerts**
- Compliant events are silently removed from the list
- Sorted by urgency: closest deadline first

### Alert Card Actions
Each alert card has a **single primary action button**:

| Kind         | Button Text           | What it does                                   |
|--------------|-----------------------|------------------------------------------------|
| Quiz         | "Log Mock Attempt"    | POST action → creates `QuizMockLog`            |
| Mid Exam     | "Log Mock Exam"       | POST action → creates `MidExamMockLog`         |
| Final Exam   | "Log Mock Exam"       | POST action → creates `FinalExamMockLog`       |
| Assignment   | "Mark as Submitted"   | POST action → sets `Assignment.submitted=true` |
| Presentation | "Mark Slides Ready"   | POST action → sets `Presentation.slidesReady=true` |

After action: redirect back to `/dashboard/warden`, flash success message. Alert card disappears.

### Compliant Events Section (optional, future)
- A collapsed section "All Clear" that shows recently completed items
- Helps user feel progress, not just pressure

### Topbar Badge
- Badge count = number of non-compliant events within alert windows
- Recalculated on every dashboard layout load
- Drops to zero when all events are compliant or no events are in window

---

## What Warden Does NOT Do

- It does **not** show static "how to study" tips
- It does **not** show future events that are not yet in the alert window  
- It does **not** give partial credit — either you logged the action or you didn't
- It does **not** send emails/push notifications (scope boundary — notifications are a separate feature)

---

## Implementation Order

1. **Schema changes** — add mock log tables + `submitted` + `slidesReady` fields, run `db push`, `generate`
2. **Course-detail tab actions** — add "Log Mock" / "Mark Submitted" / "Mark Slides Ready" buttons in the respective tabs (QuizTab, ExamTab, AssignmentTab, PresentationTab)
3. **Warden loader** — rewrite to join compliance data with each alert; filter to non-compliant only
4. **Warden actions** — handle POST for each compliance action
5. **Warden UI** — update alert cards to show the action button + confirmed/removed state
6. **Dashboard layout loader** — rewrite badge count to exclude compliant events

---

## Open Questions

- Should a user be able to **undo** a compliance log? (e.g. accidentally clicked "Log Mock")  
  → Suggestion: yes, allow one undo within 10 minutes. After that, locked.
- Should compliance be **per-buddy-visible**? (e.g. buddy sees whether you're compliant)  
  → Suggestion: yes, buddy can see your Warden status for shared courses — adds social accountability. Design in buddy-warden phase.
- Should MISSED events create a permanent record for performance tracking?  
  → Suggestion: yes, store in a `WardenMissedEvent` table for future analytics.

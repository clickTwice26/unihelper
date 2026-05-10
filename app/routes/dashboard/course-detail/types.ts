export const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;

export type Tab =
  | "information"
  | "links"
  | "storage"
  | "quiz"
  | "assignment"
  | "mid"
  | "final"
  | "presentation"
  | "attendance";

export const validTabs: Tab[] = [
  "links",
  "storage",
  "quiz",
  "assignment",
  "mid",
  "final",
  "presentation",
  "attendance",
];

export type CourseShape = {
  id: string;
  title: string;
  creditHours: number;
  teacherName: string;
  teacherInfo: string | null;
  teacherEmail: string | null;
  teacherPhone: string | null;
  blcLink: string | null;
  groupLink: string | null;
};

export type StorageFile = {
  id: string;
  name: string;
  path: string;
  isFolder: boolean;
  size: number;
  mimeType: string | null;
  key: string;
  createdAt: Date | string;
  courseId: string;
};

export type QuizEntry = {
  id: string;
  serial: number;
  title: string;
  syllabus: string;
  quizDate: Date | string;
  deadline: Date | string | null;
  createdAt: Date | string;
};

export type AssignmentEntry = {
  id: string;
  title: string;
  description: string;
  deadline: Date | string;
  createdAt: Date | string;
};

export type CourseLinkEntry = {
  id: string;
  label: string;
  url: string;
  createdAt: Date | string;
};

export type ExamEntry = {
  id: string;
  syllabus: string;
  examDate: Date | string;
  venue: string | null;
  notes: string | null;
};

export type PresentationEntry = {
  id: string;
  title: string;
  description: string;
  presentationDate: Date | string;
  venue: string | null;
  notes: string | null;
};

export type AttendanceState = "present" | "late" | "absent" | "unset";

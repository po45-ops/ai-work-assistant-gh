export type CalendarEvent = {
  id: string;
  kind: "task" | "milestone" | "project" | "google";
  title: string;
  date: string;
  time?: string | null;
  status: string;
  projectId: string | null;
  projectName: string | null;
  externalUrl?: string | null;
};

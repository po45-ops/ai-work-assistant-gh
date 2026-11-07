export type WorkSettings = {
  default_work_start: string;
  default_work_end: string;
  daily_capacity_minutes: number;
  default_focus_minutes: number;
  default_break_minutes: number;
  daily_max_important_tasks: number;
  allow_weekend: boolean;
  retention_completed_days: number;
  updated_at: string | null;
};

export const defaultWorkSettings: WorkSettings = {
  default_work_start: "18:00",
  default_work_end: "21:00",
  daily_capacity_minutes: 180,
  default_focus_minutes: 25,
  default_break_minutes: 5,
  daily_max_important_tasks: 3,
  allow_weekend: true,
  retention_completed_days: 30,
  updated_at: null,
};

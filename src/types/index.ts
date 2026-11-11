export interface TextPosition {
  x: number;
  y: number;
  size: number;
}

export interface PositionsConfig {
  name: TextPosition;
  role: TextPosition;
  color: string;
}

export interface EventItem {
  id: string;
  name: string;
  date: string | null;
  template_url: string | null;
  positions: PositionsConfig;
  created_at?: string;
}

export interface ParticipantItem {
  id: string;
  nama: string;
  peran: string;
  event_id: string | null;
  event_name: string | null;
  download_count: number;
  created_at?: string;
}

export interface DownloadItem {
  id: string;
  participant_id: string | null;
  participant_name: string;
  peran: string;
  event_id: string | null;
  event_name: string;
  download_date: string;
}

export interface PreviewRow {
  nama: string;
  peran: string;
  eventName: string;
  valid: boolean;
  status: string;
  actionType?: "new" | "update" | "skip" | "invalid";
  existingId?: string;
  mergedRoles?: string;
  mergedEvents?: string;
}

export interface RoleBadgeInfo {
  label: string;
  className: string;
}


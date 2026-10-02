export type Stage = "researched" | "contacted" | "conversation" | "demo" | "proposal" | "paid_pilot" | "declined";
export type Apartments = "yes" | "no" | "unknown";
export type Source = "google" | "manual" | "sample";

/** A saved agency row. Contains only YOUR data and the Google place ID. */
export interface AgencyListItem {
  id: number;
  place_id: string | null;
  source: Source;
  label: string | null;
  manual_name: string | null;
  pipeline_stage: Stage;
  handles_apartments: Apartments;
  updated_at: string;
  next_follow_up: string | null;
  last_contact: string | null;
  decision_maker_name: string | null;
}

export interface Agency {
  id: number;
  place_id: string | null;
  source: Source;
  manual_name: string | null;
  manual_website: string | null;
  manual_phone: string | null;
  label: string | null;
  pipeline_stage: Stage;
  handles_apartments: Apartments;
  apartment_evidence_url: string | null;
  apartment_evidence_note: string | null;
  decision_maker_name: string | null;
  decision_maker_title: string | null;
  contact_route_note: string | null;
  current_system: string | null;
  problem_described: string | null;
  decline_reason: string | null;
  permission_to_use_sample: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Call {
  id: number;
  agency_id: number;
  contacted_at: string;
  channel: "call" | "email" | "other";
  contact_person: string | null;
  outcome: "no_answer" | "left_message" | "conversation" | "meeting_booked" | "not_interested" | "other";
  notes: string | null;
  next_action: string | null;
  next_action_date: string | null;
  current_process?: string | null;
  bottleneck?: string | null;
  volume_and_effort?: string | null;
  existing_tools?: string | null;
  approver_and_error_tolerance?: string | null;
  purchase_authority?: string | null;
}

export interface Task {
  id: number;
  agency_id: number | null;
  title: string;
  due_date: string | null;
  status: "open" | "done";
  created_at?: string;
  agency_name?: string | null;
  agency_source?: Source | null;
}

export interface Demo {
  id: number;
  agency_id: number;
  scheduled_at: string;
  notes: string | null;
  outcome: string | null;
  agency_name?: string | null;
}

/** Live Google details: displayed only, NEVER stored (GOOGLE RULE 2). */
export interface LivePlace {
  id: string;
  name: string | null;
  address: string | null;
  website: string | null;
  phone: string | null;
  mapsUrl: string | null;
  businessStatus: string | null;
  attributions: { provider: string | null; providerUri: string | null }[];
}

export interface GoogleUsage { usedToday: number; perDay: number; usedThisMinute: number; perMinute: number }

export interface TimelineItem { at: string; kind: string; title: string; detail: string | null; ref: number }

import type { Apartments, Call, Stage } from "./types";

export const STAGES: Stage[] = ["researched", "contacted", "conversation", "demo", "proposal", "paid_pilot", "declined"];

export const STAGE_LABEL: Record<Stage, string> = {
  researched: "Researched", contacted: "Contacted", conversation: "Conversation", demo: "Demo",
  proposal: "Proposal", paid_pilot: "Paid pilot", declined: "Declined",
};

export const APARTMENTS_LABEL: Record<Apartments, string> = { yes: "Yes", no: "No", unknown: "Unknown" };

export const OUTCOME_LABEL: Record<Call["outcome"], string> = {
  no_answer: "No answer", left_message: "Left message", conversation: "Conversation",
  meeting_booked: "Meeting booked", not_interested: "Not interested", other: "Other",
};

export const CHANNEL_LABEL: Record<Call["channel"], string> = { call: "Call", email: "Email", other: "Other" };

export const OUTREACH =
  "Hi [Name] - I am building HQ's internal renewal workflow for agencies that handle apartment insurance. " +
  "I am building it to organise source documents, flag missing information and keep drafts in a review queue for your licensed team. " +
  "I would like to understand where your renewal preparation takes the most repeated work. " +
  "Could we spend 15 minutes looking at that process? I can demonstrate with fictional documents; you do not need to send client files.";

/** Keys match the discovery table columns. */
export const DISCOVERY_QUESTIONS = [
  ["current_process", "Current process", "Walk me through how you prepare an apartment renewal today, from first document to submission."],
  ["bottleneck", "Bottleneck", "Where does that process slow down or take the most repeated work?"],
  ["volume_and_effort", "Volume and effort", "Roughly how many apartment renewals a month, and how many hours does each take?"],
  ["existing_tools", "Existing tools", "What systems or tools do you use for this now, and what do they not do?"],
  ["approver_and_error_tolerance", "Approval and error tolerance", "Who reviews the work before it goes out, and what kind of mistake would be unacceptable?"],
  ["purchase_authority", "Purchase", "If a $1,500 pilot solved this, who would decide, and how would the purchase happen?"],
] as const;

export type DiscoveryKey = (typeof DISCOVERY_QUESTIONS)[number][0];

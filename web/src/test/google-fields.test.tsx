import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCsrfForTests } from "@/lib/api";
import type { Agency } from "@/lib/types";
import { OverviewTab } from "@/pages/agency/OverviewTab";
import { SearchPage } from "@/pages/SearchPage";
import { mockApi } from "./fetchMock";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); resetCsrfForTests(); sessionStorage.clear(); });

// Values that only Google provides. None may ever be sent back to the server.
const PLACE = {
  id: "ChIJ_fakePlaceId_123456", name: "Google Secret Name Agency", address: "999 Googleonly Street, Pittsburgh, PA",
  website: "https://google-only-website.example.com/", phone: "(412) 555-0199", mapsUrl: "https://maps.google.com/?cid=123",
  businessStatus: "OPERATIONAL", attributions: [],
};
const GOOGLE_VALUES = [PLACE.name, PLACE.address, PLACE.website, "google-only-website", PLACE.phone, PLACE.mapsUrl, "Googleonly"];

function assertNoGoogleValues(writes: { body: unknown }[]) {
  const sent = JSON.stringify(writes.map((w) => w.body));
  for (const v of GOOGLE_VALUES) expect(sent).not.toContain(v);
}

describe("no Google-derived field is persisted by any UI path", () => {
  it("Search → Save sends the place ID only", async () => {
    const m = mockApi({
      "GET /status": { googleEnabled: true, usage: { usedToday: 0, perDay: 200, usedThisMinute: 0, perMinute: 10 } },
      "POST /places/search": { results: [PLACE] },
      "POST /agencies": { id: 9 },
    });
    sessionStorage.setItem("hq.city", "Pittsburgh");
    render(<SearchPage query={new URLSearchParams()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^search$/i }));
    expect(await screen.findByText(PLACE.name)).toBeInTheDocument();
    expect(screen.getAllByText("Google Maps").length).toBeGreaterThan(0); // attribution shown
    await user.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(m.calls.some((c) => c.method === "POST" && c.url === "/api/agencies")).toBe(true));
    const save = m.calls.find((c) => c.method === "POST" && c.url === "/api/agencies")!;
    expect(save.body).toEqual({ place_id: PLACE.id });
    // The search request itself sends only what you typed.
    const search = m.calls.find((c) => c.url === "/api/places/search")!;
    expect(Object.keys(search.body as object).sort()).toEqual(["city", "query"]);
    assertNoGoogleValues(m.writes().filter((w) => w.url !== "/api/places/search"));
  });

  it("Relink sends the place ID only", async () => {
    const m = mockApi({
      "GET /status": { googleEnabled: true, usage: { usedToday: 0, perDay: 200, usedThisMinute: 0, perMinute: 10 } },
      "POST /places/search": { results: [PLACE] },
      "PUT /agencies/4/place": { ok: true },
    });
    sessionStorage.setItem("hq.city", "Pittsburgh");
    render(<SearchPage query={new URLSearchParams("relink=4")} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /^search$/i }));
    await user.click(await screen.findByRole("button", { name: /use this listing/i }));
    await waitFor(() => expect(m.calls.some((c) => c.method === "PUT")).toBe(true));
    expect(m.calls.find((c) => c.method === "PUT")!.body).toEqual({ place_id: PLACE.id });
  });

  it("editing an agency next to the live Google card sends only your typed fields", async () => {
    const m = mockApi({
      "GET /places/ChIJ_fakePlaceId_123456": { place: PLACE },
      "PATCH /agencies/5": { ok: true },
    });
    const agency: Agency = {
      id: 5, place_id: PLACE.id, source: "google", manual_name: null, manual_website: null, manual_phone: null, label: null,
      pipeline_stage: "contacted", handles_apartments: "unknown", apartment_evidence_url: null, apartment_evidence_note: null,
      decision_maker_name: null, decision_maker_title: null, contact_route_note: null, current_system: null, problem_described: null,
      decline_reason: null, permission_to_use_sample: 0, notes: null, created_at: "", updated_at: "",
    };
    render(<OverviewTab agency={agency} onPatched={() => {}} onLivePlace={() => {}} />);
    expect(await screen.findByText(PLACE.name)).toBeInTheDocument(); // live details displayed
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Decision maker"), "Pat Example");
    await user.type(screen.getByLabelText("Your label"), "Keystone");
    await user.tab();
    await waitFor(() => expect(m.writes().length).toBeGreaterThanOrEqual(2));
    for (const w of m.writes()) {
      expect(w.url).toBe("/api/agencies/5");
      for (const k of Object.keys(w.body as object)) expect(["decision_maker_name", "label"]).toContain(k);
    }
    assertNoGoogleValues(m.writes());
  });
});

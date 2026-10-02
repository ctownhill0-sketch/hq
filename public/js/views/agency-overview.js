// Overview tab (live Google card or your own data, licence check,
// qualification with autosave, call script) and the Notes tab.
import { api } from '../api.js';
import { h, field, select, extLink, googleAttribution, LABELS, btn, hostOf, fmtDateTime } from '../dom.js';
import { icon } from '../icons.js';
import { bindAutosave, saveIndicator } from '../ui/autosave.js';
import { toast } from '../ui/toast.js';
import { notifyChange } from '../store.js';
import { scriptPanel } from './script.js';

const patch = (id) => async (body) => {
  await api(`/agencies/${id}`, { method: 'PATCH', body });
  notifyChange({ agencyId: id, kind: 'edit', silent: true });
};

export async function overviewTab(ctx) {
  const a = ctx.agency;
  return h('div', { class: 'stack' },
    a.source === 'google' ? googleCard(ctx) : ownDataCard(ctx),
    licenceCard(ctx),
    qualificationCard(ctx),
    scriptPanel(a.decision_maker_name));
}

// ---------- Live Google details ----------
// GOOGLE RULE 2: fetched live, displayed, never saved. RULE 4: attribution
// shown with the data. RULE 5: NOT_FOUND -> "Listing no longer available".
function googleCard(ctx) {
  const a = ctx.agency;
  const body = h('div', { class: 'card-body' });
  const card = h('section', { class: 'card google-card', 'aria-label': 'Live Google details' },
    h('div', { class: 'card-head' }, h('span', { class: 'card-eyebrow' }, icon('pin', { size: 13 }), 'Live from Google · not stored'),
      btn('', { size: 'sm', kind: 'ghost', iconName: 'refresh', title: 'Reload live details (uses 1 Google call)', onClick: load })),
    body);
  async function load() {
    body.replaceChildren(h('span', { class: 'skeleton skeleton-title' }), h('span', { class: 'skeleton skeleton-line' }), h('span', { class: 'skeleton skeleton-line', vars: { width: '60%' } }));
    try {
      const { place: p } = await api(`/places/${encodeURIComponent(a.place_id)}`);
      ctx.liveWebsite = p.website || null;
      ctx.setTitle(p.name || 'Google listing', h('span', { class: 'gmaps-attr xs', translate: 'no' }, 'Google Maps'));
      body.replaceChildren(
        h('h2', {}, p.name || '(no name)'),
        p.businessStatus && p.businessStatus !== 'OPERATIONAL' ? h('span', { class: 'badge badge-warning' }, p.businessStatus.replace(/_/g, ' ').toLowerCase()) : '',
        h('dl', { class: 'kv', vars: { 'margin-top': '12px' } },
          h('dt', {}, 'Address'), h('dd', {}, p.address || '-'),
          h('dt', {}, 'Phone'), h('dd', { class: 'num' }, p.phone || '-'),
          h('dt', {}, 'Website'), h('dd', {}, p.website ? extLink(p.website, hostOf(p.website)) : '-'),
          h('dt', {}, 'Map'), h('dd', {}, p.mapsUrl ? extLink(p.mapsUrl, 'View on Google Maps') : '-')),
        googleAttribution(p.attributions));
    } catch (e) {
      if (e.code === 'NOT_FOUND') {
        body.replaceChildren(h('div', { class: 'callout callout-warn' }, icon('alert'), h('div', { class: 'stack-sm' },
          h('strong', {}, 'Listing no longer available'),
          h('p', {}, 'Google no longer recognises this saved place ID. The agency may have moved, closed or merged listings. Your notes are safe.'),
          h('div', {}, h('a', { class: 'btn btn-sm', href: `#/search?relink=${a.id}` }, icon('search', { size: 14 }), 'Search again to relink')))));
      } else if (e.code === 'NO_KEY') {
        body.replaceChildren(h('div', { class: 'callout callout-info' }, icon('alert'), h('div', {}, 'Live Google details are off: no API key in .env. Everything else on this page works.')));
      } else {
        body.replaceChildren(h('div', { class: 'callout callout-danger' }, icon('alert'), h('div', { class: 'spacer' }, `Could not load Google details. ${e.message}`), btn('Retry', { size: 'sm', iconName: 'refresh', onClick: load })));
      }
    }
  }
  load();
  return card;
}

// Manual/sample agencies: the name, website and phone are your own data.
function ownDataCard(ctx) {
  const a = ctx.agency;
  const ind = saveIndicator();
  const name = h('input', { name: 'manual_name', value: a.manual_name || '', required: true, maxlength: 200 });
  const site = h('input', { name: 'manual_website', type: 'url', value: a.manual_website || '', placeholder: 'https://…' });
  const phone = h('input', { name: 'manual_phone', value: a.manual_phone || '', maxlength: 40 });
  bindAutosave([name, site, phone], patch(a.id), ind);
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('span', { class: 'card-eyebrow' }, icon('notes', { size: 13 }), a.source === 'sample' ? 'Fictional sample data' : 'Your own data · added by hand'), ind.el),
    h('div', { class: 'card-body form-grid' },
      field('Agency name', name, null, 'span-12'),
      field('Website', site, a.manual_website ? extLink(a.manual_website, 'Open website ↗') : null, 'span-6'),
      field('Phone', phone, null, 'span-6')));
}

// ---------- Licence check (you do it; the app only records it) ----------
function licenceCard(ctx) {
  const a = ctx.agency;
  const box = h('input', { type: 'checkbox', checked: Boolean(a.licence_verified) });
  const when = h('span', { class: 'xs subtle' }, a.licence_verified_at ? `Verified ${fmtDateTime(a.licence_verified_at)}` : '');
  box.addEventListener('change', async () => {
    const v = box.checked;
    try {
      await api(`/agencies/${a.id}/licence`, { method: 'PUT', body: { verified: v } });
      a.licence_verified = v ? 1 : 0;
      when.textContent = v ? 'Verified just now' : '';
      toast(v ? 'Licence check recorded' : 'Licence check cleared');
      ctx.refreshTimeline();
    } catch (e) { box.checked = !v; toast(e.message, { kind: 'error' }); }
  });
  return h('section', { class: 'card card-pad' },
    h('div', { class: 'row' },
      h('div', { class: 'stack-sm spacer' },
        h('h3', { class: 'row' }, icon('shield'), 'Licence check'),
        h('p', { class: 'small muted' }, 'Look the agency up on the Pennsylvania Insurance Department\'s producer lookup yourself, then tick the box. HQ Desk does not automate this lookup.')),
      h('a', { class: 'btn', href: ctx.licenceLookupUrl, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Verify licence')),
    h('div', { class: 'row', vars: { 'margin-top': '12px' } }, h('label', { class: 'check' }, box, 'I verified this agency\'s licence'), when));
}

// ---------- Qualification (autosave) ----------
function qualificationCard(ctx) {
  const a = ctx.agency;
  const ind = saveIndicator();
  const inputs = {
    handles_apartments: select('handles_apartments', Object.entries(LABELS.apartments), a.handles_apartments),
    apartment_evidence_url: h('input', { name: 'apartment_evidence_url', type: 'url', value: a.apartment_evidence_url || '', placeholder: 'https://…' }),
    apartment_evidence_note: h('input', { name: 'apartment_evidence_note', value: a.apartment_evidence_note || '', maxlength: 2000 }),
    decision_maker_name: h('input', { name: 'decision_maker_name', value: a.decision_maker_name || '', maxlength: 120 }),
    decision_maker_title: h('input', { name: 'decision_maker_title', value: a.decision_maker_title || '', maxlength: 120 }),
    contact_route_note: h('input', { name: 'contact_route_note', value: a.contact_route_note || '', maxlength: 2000, placeholder: 'e.g. front desk, ask for Pat' }),
    current_system: h('textarea', { name: 'current_system', rows: 2, maxlength: 2000 }, a.current_system || ''),
    problem_described: h('textarea', { name: 'problem_described', rows: 2, maxlength: 4000 }, a.problem_described || ''),
    permission_to_use_sample: h('input', { type: 'checkbox', name: 'permission_to_use_sample', checked: Boolean(a.permission_to_use_sample) }),
    decline_reason: h('textarea', { name: 'decline_reason', rows: 2, maxlength: 2000 }, a.decline_reason || ''),
  };
  if (a.source === 'google') inputs.label = h('input', { name: 'label', value: a.label || '', maxlength: 120, placeholder: 'Your short name for lists' });
  bindAutosave(Object.values(inputs), patch(a.id), ind);
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, icon('check'), 'Qualification'), ind.el),
    h('div', { class: 'card-body form-grid' },
      field('Handles apartments?', inputs.handles_apartments, null, 'span-4'),
      field('Apartment evidence link', inputs.apartment_evidence_url, a.apartment_evidence_url ? extLink(a.apartment_evidence_url, 'Open evidence ↗') : null, 'span-8'),
      field('Evidence note', inputs.apartment_evidence_note, null, 'span-12'),
      field('Decision maker', inputs.decision_maker_name, null, 'span-6'),
      field('Title', inputs.decision_maker_title, null, 'span-6'),
      field('Contact route', inputs.contact_route_note, null, 'span-12'),
      field('Current system', inputs.current_system, null, 'span-6'),
      field('Problem they described', inputs.problem_described, null, 'span-6'),
      inputs.label ? field('Your label', inputs.label, 'Typed by you, shown in lists. Not copied from Google.', 'span-12') : null,
      a.pipeline_stage === 'declined' || a.decline_reason ? field('Decline reason', inputs.decline_reason, null, 'span-12') : null,
      h('label', { class: 'check span-12' }, inputs.permission_to_use_sample, 'They gave permission to use a sample of their (non-client) material')));
}

export async function notesTab(ctx) {
  const a = ctx.agency;
  const ind = saveIndicator();
  const notes = h('textarea', { name: 'notes', rows: 16, maxlength: 10000, placeholder: 'Anything worth remembering about this agency…', 'aria-label': 'Notes', 'data-new': '' }, a.notes || '');
  bindAutosave([notes], patch(a.id), ind);
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', {}, icon('notes'), 'Notes'), ind.el),
    h('div', { class: 'card-body' }, notes, h('p', { class: 'field-hint', vars: { 'margin-top': '8px' } }, 'Saves automatically as you type. Accepted research findings are appended here with their source.')));
}

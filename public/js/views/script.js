// Collapsible call script: outreach message + the six discovery questions.
import { h, copyText, btn } from '../dom.js';
import { icon } from '../icons.js';

export const OUTREACH = 'Hi [Name] - I am building HQ\'s internal renewal workflow for agencies that handle apartment insurance. '
  + 'I am building it to organise source documents, flag missing information and keep drafts in a review queue for your licensed team. '
  + 'I would like to understand where your renewal preparation takes the most repeated work. '
  + 'Could we spend 15 minutes looking at that process? I can demonstrate with fictional documents; you do not need to send client files.';

// Keys match the discovery table columns.
export const DISCOVERY_QUESTIONS = [
  ['current_process', '1. Current process', 'Walk me through how you prepare an apartment renewal today, from first document to submission.'],
  ['bottleneck', '2. Bottleneck', 'Where does that process slow down or take the most repeated work?'],
  ['volume_and_effort', '3. Volume and effort', 'Roughly how many apartment renewals a month, and how many hours does each take?'],
  ['existing_tools', '4. Existing tools', 'What systems or tools do you use for this now, and what do they not do?'],
  ['approver_and_error_tolerance', '5. Approval and error tolerance', 'Who reviews the work before it goes out, and what kind of mistake would be unacceptable?'],
  ['purchase_authority', '6. Purchase', 'If a $1,500 pilot solved this, who would decide, and how would the purchase happen?'],
];

function chevron() {
  const i = icon('chevronRight', { size: 14 });
  i.classList.add('chev');
  return i;
}

export function scriptPanel(name) {
  const text = name ? OUTREACH.replace('[Name]', name.split(' ')[0]) : OUTREACH;
  return h('details', { class: 'card disclosure' },
    h('summary', { class: 'card-pad' }, chevron(), icon('message'), 'Call script', h('span', { class: 'xs subtle' }, 'outreach message + six discovery questions')),
    h('div', { class: 'card-body stack', vars: { 'padding-top': '0' } },
      h('div', { class: 'row' }, h('h3', {}, 'Outreach message'), h('span', { class: 'spacer' }), btn('Copy', { size: 'sm', iconName: 'copy', onClick: () => copyText(text) })),
      h('p', { class: 'script-text' }, text),
      h('h3', {}, 'Six discovery questions'),
      h('ol', { class: 'questions' }, DISCOVERY_QUESTIONS.map(([, label, q]) => h('li', {}, h('strong', {}, `${label.replace(/^\d\. /, '')}: `), q))),
      h('p', { class: 'xs subtle' }, 'You are learning about their process: no coverage advice, and never ask them to send client files. Nothing here is sent automatically.')));
}

import { i18n } from './i18n';
import {
  normalizeEmail,
  splitName,
  type ContactInput,
  type Person,
  type Sender,
} from './model';

const element = <TElement extends HTMLElement>(id: string) => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element: ${id}`);
  return found as TElement;
};
const labels: Record<string, string> = {
  subtitle: i18n._('Relationships, right beside your email'),
  dashboard: i18n._('Dashboard ↗'),
  people: i18n._('People ↗'),
  'context-label': i18n._('Current conversation'),
  'sender-label': i18n._('Sender'),
  'context-description': i18n._(
    'Open a Gmail message to capture its sender, or enter a contact below.',
  ),
  'use-email': i18n._('Use email sender'),
  manual: i18n._('Enter manually'),
  'form-heading': i18n._('Contact details'),
  'first-name-label': i18n._('First name'),
  'last-name-label': i18n._('Last name'),
  'email-label': i18n._('Email address'),
  'job-title-label': i18n._('Job title (optional)'),
  save: i18n._('Add contact'),
  privacy: i18n._(
    'Saves to Twenty on this Mac. This sidebar reads sender details from the open conversation and does not send email.',
  ),
};
for (const [id, label] of Object.entries(labels))
  element(id).textContent = label;
const form = element<HTMLFormElement>('contact-form');
const senderSelect = element<HTMLSelectElement>('sender');
const contactLink = element<HTMLAnchorElement>('contact-link');
const setFormDisabled = (disabled: boolean) => {
  for (const control of form.querySelectorAll<
    HTMLInputElement | HTMLButtonElement
  >('input,button'))
    control.disabled = disabled;
};
let senders: Sender[] = [];
let currentContext = '';
let manualEntry = false;
let saving = false;
let lookupSequence = 0;

const input = (id: string) => element<HTMLInputElement>(id);
const status = (text: string, tone = '') => {
  element('status').textContent = text;
  element('status').dataset.tone = tone;
};
const showPerson = (person: Person) => {
  contactLink.href = `http://localhost:3001/object/person/${encodeURIComponent(person.id)}`;
  contactLink.textContent = i18n._('View contact in CRM ↗');
  contactLink.hidden = false;
};
const request = async (message: unknown) => {
  const response = (await chrome.runtime.sendMessage(message)) as {
    ok?: boolean;
    result?: unknown;
    error?: string;
  };
  if (!response?.ok)
    throw new Error(
      response?.error ||
        i18n._('Reload Gmail and the CRM extension, then try again.'),
    );
  return response.result;
};
const lookup = async () => {
  const sequence = ++lookupSequence;
  contactLink.hidden = true;
  status('');
  let email: string;
  try {
    email = normalizeEmail(input('email').value);
  } catch {
    return;
  }
  status(i18n._('Checking Twenty…'));
  try {
    const person = (await request({
      type: 'FIND_CONTACT',
      email,
    })) as Person | null;
    if (sequence !== lookupSequence || saving) return;
    if (person) {
      status(
        i18n._('Already in your CRM. Saving again will use this contact.'),
      );
      showPerson(person);
    } else status(i18n._('Ready to add this contact.'));
  } catch (error) {
    if (sequence === lookupSequence && !saving)
      status(
        error instanceof Error
          ? error.message
          : i18n._('Could not check the CRM.'),
        'error',
      );
  }
};
const useSender = () => {
  const sender = senders.find(
    (candidate) => candidate.email === senderSelect.value,
  );
  if (!sender || saving) return;
  manualEntry = false;
  const name = splitName(sender.name === sender.email ? '' : sender.name);
  input('first-name').value = name.firstName;
  input('last-name').value = name.lastName;
  input('email').value = sender.email;
  input('job-title').value = '';
  void lookup();
};
const refreshContext = async () => {
  if (saving) return;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    let context: { senders: Sender[]; messageKey: string } = {
      senders: [],
      messageKey: '',
    };
    if (tab?.id !== undefined) {
      try {
        context = (await chrome.tabs.sendMessage(tab.id, {
          type: 'READ_SENDERS',
        })) as typeof context;
      } catch {
        // Other sites have no Gmail content script; no broader tab access is needed.
      }
    }
    const contextKey = `${tab?.id}:${context.messageKey}:${JSON.stringify(context.senders)}`;
    if (contextKey === currentContext) return;
    currentContext = contextKey;
    senders = context.senders;
    senderSelect.replaceChildren(
      ...senders.map((sender) => {
        const option = document.createElement('option');
        option.value = sender.email;
        option.textContent = sender.name
          ? `${sender.name} <${sender.email}>`
          : sender.email;
        return option;
      }),
    );
    senderSelect.disabled = senders.length === 0;
    element<HTMLButtonElement>('use-email').disabled = senders.length === 0;
    if (senders.length) senderSelect.value = senders[senders.length - 1].email;
    if (!manualEntry) {
      if (senders.length) useSender();
      else {
        form.reset();
        ++lookupSequence;
        contactLink.hidden = true;
        status(i18n._('Open an email, or enter a contact manually.'));
      }
    }
  } catch {
    element('context-description').textContent = i18n._(
      'Reload this Gmail tab to connect the sidebar. You can still enter a contact manually.',
    );
  }
};
senderSelect.addEventListener('change', useSender);
element('use-email').addEventListener('click', useSender);
element('manual').addEventListener('click', () => {
  if (saving) return;
  manualEntry = true;
  form.reset();
  ++lookupSequence;
  contactLink.hidden = true;
  status(i18n._('Enter the person’s details below.'));
  input('first-name').focus();
});
form.addEventListener('input', () => {
  manualEntry = true;
  ++lookupSequence;
  contactLink.hidden = true;
  status('');
});
input('email').addEventListener('change', () => {
  void lookup();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (saving || !form.reportValidity()) return;
  saving = true;
  ++lookupSequence;
  setFormDisabled(true);
  status(i18n._('Saving contact…'));
  const contact: ContactInput = {
    email: input('email').value,
    firstName: input('first-name').value,
    lastName: input('last-name').value,
    jobTitle: input('job-title').value,
  };
  void request({ type: 'SAVE_CONTACT', contact })
    .then((result) => {
      const saved = result as { person: Person; created: boolean };
      showPerson(saved.person);
      status(
        saved.created
          ? i18n._('Contact added to your CRM.')
          : i18n._(
              'This contact is already in your CRM. No duplicate created.',
            ),
        'success',
      );
    })
    .catch((error) =>
      status(
        error instanceof Error
          ? error.message
          : i18n._('Could not save this contact.'),
        'error',
      ),
    )
    .finally(() => {
      saving = false;
      setFormDisabled(false);
    });
});
void refreshContext();
setInterval(() => {
  void refreshContext();
}, 1500);

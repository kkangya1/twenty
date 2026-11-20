import {
  createPeopleClient,
  parseConfiguration,
  type ContactInput,
} from './model';

const client = fetch(chrome.runtime.getURL('local-config.json'))
  .then((response) => response.json())
  .then(parseConfiguration)
  .then((configuration) => createPeopleClient(configuration));
// Attach a rejection handler before Chrome delivers the first request.
void client.catch(() => {});
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    typeof message !== 'object' ||
    message === null
  )
    return;
  const input = message as Record<string, unknown>;
  if (
    input.type === 'OPEN_SIDEBAR' &&
    sender.tab?.id !== undefined &&
    sender.url?.startsWith('https://mail.google.com/mail/')
  ) {
    void chrome.sidePanel
      .open({ tabId: sender.tab.id })
      .then(() => respond({ ok: true }))
      .catch(() => respond({ ok: false }));
    return true;
  }
  if (sender.url !== chrome.runtime.getURL('sidebar.html')) return;
  const execute = async () => {
    const people = await client;
    if (input.type === 'FIND_CONTACT' && typeof input.email === 'string')
      return people.find(input.email);
    if (
      input.type === 'SAVE_CONTACT' &&
      typeof input.contact === 'object' &&
      input.contact !== null
    ) {
      const contact = input.contact as Record<string, unknown>;
      if (
        ['email', 'firstName', 'lastName', 'jobTitle'].every(
          (key) => typeof contact[key] === 'string',
        )
      )
        return people.save(contact as ContactInput);
    }
    throw new Error('Invalid sidebar request');
  };
  void execute()
    .then((result) => respond({ ok: true, result }))
    .catch((error) =>
      respond({
        ok: false,
        error: error instanceof Error ? error.message : 'Request failed',
      }),
    );
  return true;
});

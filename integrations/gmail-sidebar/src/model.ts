import { i18n } from './i18n';

export type ContactInput = {
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
};
export type Person = {
  id: string;
  name?: { firstName?: string; lastName?: string };
  emails?: { primaryEmail?: string };
};
export type Configuration = { apiUrl: string; appUrl: string; apiKey: string };
export type Sender = { email: string; name: string };

export const normalizeEmail = (value: string) => {
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
      email,
    )
  ) {
    throw new Error(i18n._('Enter a valid email address.'));
  }
  return email;
};

export const splitName = (name: string) => {
  const [firstName = '', ...lastName] = name
    .trim()
    .replace(/^"|"$/g, '')
    .split(/\s+/);
  return { firstName, lastName: lastName.join(' ') };
};

export const parseConfiguration = (value: unknown): Configuration => {
  if (typeof value !== 'object' || value === null)
    throw new Error(i18n._('Sidebar connection is not configured.'));
  const configuration = value as Record<string, unknown>;
  if (
    configuration.apiUrl !== 'http://localhost:3000' ||
    configuration.appUrl !== 'http://localhost:3001' ||
    typeof configuration.apiKey !== 'string' ||
    !configuration.apiKey.startsWith('eyJ')
  ) {
    throw new Error(
      i18n._('Configure a local Twenty API key, then reload this extension.'),
    );
  }
  return configuration as Configuration;
};

const isPerson = (value: unknown): value is Person =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === 'string';

export const createPeopleClient = (
  configuration: Configuration,
  request: typeof fetch = fetch,
) => {
  const pendingSaves = new Map<
    string,
    Promise<{ person: Person; created: boolean }>
  >();
  const call = async (path: string, body?: unknown) => {
    let response: Response;
    try {
      response = await request(`${configuration.apiUrl}/rest/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
        credentials: 'omit',
        redirect: 'error',
      });
    } catch {
      throw new Error(
        i18n._('Cannot reach Twenty. Start the CRM on this Mac and try again.'),
      );
    }
    if (response.status === 401)
      throw new Error(i18n._('The CRM API key has expired or was revoked.'));
    if (response.status === 403)
      throw new Error(
        i18n._(
          'The sidebar needs permission to read and create People in Twenty.',
        ),
      );
    if (!response.ok)
      throw new Error(
        i18n._('Twenty could not complete this request. Try again.'),
      );
    const result = (await response.json()) as {
      data?: Record<string, unknown>;
    };
    if (!result.data)
      throw new Error(i18n._('Twenty returned an unexpected response.'));
    return result.data;
  };
  const find = async (value: string): Promise<Person | null> => {
    const email = normalizeEmail(value);
    // Twenty's REST parser strips quotes without JSON-unescaping the value.
    const literal = `"${email.replace(/[%_]/g, '\\$&')}"`;
    const parameters = new URLSearchParams({
      filter: `emails.primaryEmail[ilike]:${literal}`,
      limit: '1',
      depth: '0',
      fields: 'id,name,emails',
    });
    const data = await call(`people?${parameters}`);
    if (!Array.isArray(data.people))
      throw new Error(i18n._('Twenty returned an unexpected contact list.'));
    const person = data.people[0];
    if (person === undefined) return null;
    if (!isPerson(person))
      throw new Error(i18n._('Twenty returned an unexpected contact.'));
    return person;
  };
  const save = (input: ContactInput) => {
    const email = normalizeEmail(input.email);
    const pending = pendingSaves.get(email);
    if (pending) return pending;
    const operation = (async () => {
      const existing = await find(email);
      if (existing) return { person: existing, created: false };
      const data = await call('people?depth=0&fields=id,name,emails', {
        name: {
          firstName: input.firstName.trim().slice(0, 100),
          lastName: input.lastName.trim().slice(0, 100),
        },
        emails: { primaryEmail: email, additionalEmails: [] },
        jobTitle: input.jobTitle.trim().slice(0, 200),
      });
      if (!isPerson(data.createPerson))
        throw new Error(i18n._('Twenty returned an unexpected contact.'));
      return { person: data.createPerson, created: true };
    })();
    pendingSaves.set(email, operation);
    void operation.finally(() => pendingSaves.delete(email)).catch(() => {});
    return operation;
  };
  return { find, save };
};

export const readSenders = (document: Document): Sender[] => {
  const senders = new Map<string, Sender>();
  for (const element of document.querySelectorAll<HTMLElement>('.gD[email]')) {
    if (!element.getClientRects().length || !element.closest('.adn')) continue;
    try {
      const email = normalizeEmail(element.getAttribute('email') ?? '');
      senders.set(email, {
        email,
        name: element.getAttribute('name') || element.textContent?.trim() || '',
      });
    } catch {
      /* Gmail can render non-address placeholders while loading. */
    }
  }
  return [...senders.values()];
};

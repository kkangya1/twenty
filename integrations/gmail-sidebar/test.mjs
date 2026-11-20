import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const directory = await mkdtemp(join(tmpdir(), 'twenty-sidebar-test-'));
try {
  await build({
    entryPoints: [new URL('src/model.ts', import.meta.url).pathname],
    outfile: join(directory, 'model.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
  });
  const { createPeopleClient, normalizeEmail, parseConfiguration, splitName } =
    await import(pathToFileURL(join(directory, 'model.mjs')).href);
  const configuration = {
    apiUrl: 'http://localhost:3000',
    appUrl: 'http://localhost:3001',
    apiKey: 'eyJ.test',
  };
  const contact = {
    email: 'Person+crm@example.com',
    firstName: '  Morgan ',
    lastName: 'Lee',
    jobTitle: 'Founder',
  };
  const person = {
    id: 'test-person',
    emails: { primaryEmail: 'person+crm@example.com' },
  };
  const response = (data) => Response.json({ data });
  await test('normalizes addresses, preserves plus tags, and rejects filter injection', () => {
    assert.equal(
      normalizeEmail(' Person+CRM@Example.com '),
      'person+crm@example.com',
    );
    assert.throws(() => normalizeEmail('bad@example.com,position[eq]:1'));
    assert.deepEqual(splitName('Morgan Chen Lee'), {
      firstName: 'Morgan',
      lastName: 'Chen Lee',
    });
  });
  await test('refuses nonlocal credential destinations', () => {
    assert.throws(() =>
      parseConfiguration({ ...configuration, apiUrl: 'https://example.com' }),
    );
    assert.throws(() =>
      parseConfiguration({ ...configuration, appUrl: 'https://example.com' }),
    );
  });
  await test('creates a contact using the Twenty response envelope', async () => {
    const calls = [];
    const client = createPeopleClient(configuration, async (url, options) => {
      calls.push({ url, options });
      return response(
        options.method === 'POST' ? { createPerson: person } : { people: [] },
      );
    });
    assert.deepEqual(await client.save(contact), { person, created: true });
    assert.equal(calls.length, 2);
    assert.equal(
      JSON.parse(calls[1].options.body).emails.primaryEmail,
      'person+crm@example.com',
    );
    assert.equal(JSON.parse(calls[1].options.body).name.firstName, 'Morgan');
    assert.equal(calls[1].options.redirect, 'error');
  });
  await test('reuses an existing contact without a write', async () => {
    const client = createPeopleClient(configuration, async (_url, options) => {
      assert.equal(options.method, 'GET');
      return response({ people: [person] });
    });
    assert.deepEqual(await client.save(contact), { person, created: false });
  });
  await test('coalesces simultaneous saves for the same email', async () => {
    let writes = 0;
    const client = createPeopleClient(configuration, async (_url, options) => {
      if (options.method === 'POST') {
        writes++;
        return response({ createPerson: person });
      }
      return response({ people: [] });
    });
    await Promise.all([
      client.save(contact),
      client.save({ ...contact, email: contact.email.toUpperCase() }),
    ]);
    assert.equal(writes, 1);
  });
  await test('never creates after a failed lookup', async () => {
    const client = createPeopleClient(configuration, async (_url, options) => {
      assert.equal(options.method, 'GET');
      return new Response('', { status: 403 });
    });
    await assert.rejects(client.save(contact), /permission/);
  });
  await test('escapes wildcard characters in email lookup', async () => {
    const client = createPeopleClient(configuration, async (url) => {
      assert.equal(
        new URL(url).searchParams.get('filter'),
        'emails.primaryEmail[ilike]:"morgan\\_lee@example.com"',
      );
      return response({ people: [] });
    });
    await client.find('morgan_lee@example.com');
  });
} finally {
  await rm(directory, { recursive: true, force: true });
}

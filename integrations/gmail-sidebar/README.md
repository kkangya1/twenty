# Terranova CRM for Gmail

A small Chrome extension for the local Twenty development instance. Open a Gmail conversation, click **CRM** at the bottom right, review the sender, then click **Add contact**. The panel also supports manual entry, existing-contact lookup, and links to People and Dashboards.

Source is part of this fork and can be edited independently of Twenty. No Google Apps Script deployment, public tunnel, or additional Google OAuth app is needed. This is a local development extension, not a Chrome Web Store release.

## Setup

1. In Twenty, create a role assignable to API keys. Allow reading and creating/updating **People** only; leave deleting, other objects, tools, and settings disabled. Twenty groups create/update in one permission.
2. Under **Settings → Developers → API keys**, create a key with that role. Choose an expiry and keep the key private.
3. Copy `local-config.example.json` to `local-config.json` and replace the placeholder. Keep the localhost URLs. Both the configuration file and build output are ignored by Git.
4. From the repository root, run `yarn node integrations/gmail-sidebar/build.mjs`.
5. In the Terranova Chrome profile, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and select `integrations/gmail-sidebar/dist`.
6. Reload the Gmail tab. Click **CRM** or the extension's toolbar icon.

After editing source, rebuild and click Reload on the extension card. Reload Gmail after changing its content script. Keep Twenty running at <http://localhost:3001>.

## Privacy and behavior

- Only the Gmail content script reads the visible conversation's sender headers. It does not read message bodies, attachments, or cookies. The native sidebar owns the form and contact results.
- Only the extension service worker reads the API credential. It is not web-accessible, placed in Gmail's DOM, or synced to Chrome storage. Do not share the configured extension folder.
- Requests are restricted to `http://localhost:3000`; links open `http://localhost:3001`. There is no proxy, telemetry, or third-party service.
- Saving checks the primary email case-insensitively before creating. Concurrent clicks within this extension share one save. Existing records are opened without overwriting names. This does not enforce a database-wide uniqueness constraint or match secondary email addresses.
- The sidebar works independently of mailbox synchronization. It does not grant delegated Gmail API access or connect another person's mailbox.

## Validation

From the repository root: `yarn node integrations/gmail-sidebar/test.mjs` and `yarn tsc -p integrations/gmail-sidebar/tsconfig.json`. Tests cover creation, duplicate lookup, concurrent clicks, lookup failure, and safe local configuration.

Chrome implementation references: [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [extension network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

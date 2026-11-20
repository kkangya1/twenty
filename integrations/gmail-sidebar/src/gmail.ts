import { i18n } from './i18n';
import { readSenders } from './model';

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    sender.id !== chrome.runtime.id ||
    typeof message !== 'object' ||
    message === null ||
    (message as Record<string, unknown>).type !== 'READ_SENDERS'
  )
    return;
  respond({ senders: readSenders(document), messageKey: location.hash });
});

const host = document.createElement('div');
host.style.cssText =
  'position:fixed;right:18px;bottom:26px;z-index:2147483646;';
const root = host.attachShadow({ mode: 'closed' });
const button = document.createElement('button');
button.textContent = i18n._('CRM');
button.title = i18n._('Add this sender to Terranova CRM');
button.style.cssText =
  'font:600 13px system-ui;cursor:pointer;background:#fff;color:#333;border:1px solid #d9d9d9;border-radius:8px;padding:11px 14px;box-shadow:0 2px 8px #0002;';
button.addEventListener('click', () => {
  void chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' }).catch(() => {
    button.title = i18n._('Reload Gmail after reloading the CRM extension.');
  });
});
root.append(button);
document.body.append(host);

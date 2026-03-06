/**
 * In-memory store for candidate email verification codes.
 * Codes expire after 15 minutes. One-time use.
 */

interface Entry {
  code: string;
  expires: Date;
  /** Rate-limit: when the last code was sent */
  sentAt: Date;
}

const store = new Map<string, Entry>();

// Purge expired entries every 10 minutes to prevent memory leaks
setInterval(() => {
  const now = new Date();
  for (const [key, entry] of store) {
    if (entry.expires < now) store.delete(key);
  }
}, 10 * 60 * 1000);

export function canRequestCode(email: string): boolean {
  const entry = store.get(email.toLowerCase());
  if (!entry) return true;
  // Rate-limit: at most 1 code per 60 seconds
  return Date.now() - entry.sentAt.getTime() > 60_000;
}

export function storeCode(email: string, code: string): void {
  store.set(email.toLowerCase(), {
    code,
    expires: new Date(Date.now() + 15 * 60 * 1000),
    sentAt: new Date(),
  });
}

/** Returns true and deletes the entry if the code is valid and not expired. */
export function consumeCode(email: string, code: string): boolean {
  const entry = store.get(email.toLowerCase());
  if (!entry) return false;
  if (entry.expires < new Date()) {
    store.delete(email.toLowerCase());
    return false;
  }
  if (entry.code !== code.trim()) return false;
  store.delete(email.toLowerCase()); // one-time use
  return true;
}

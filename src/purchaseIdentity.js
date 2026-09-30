// Serialize account changes; refuse a purchase if login changed while it was loading.
export function createPurchaseIdentity(purchases, apiKey) {
  let configured = false, current = null, requested = null, queue = Promise.resolve();
  function select(userId) {
    const id = String(userId ?? '');
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Promise.reject(new Error('Sign in before purchasing.'));
    requested = id;
    const next = queue.catch(() => {}).then(async () => {
      if (!configured) { await purchases.configure({ apiKey, appUserID: id }); configured = true; }
      else if (current !== id) await purchases.logIn({ appUserID: id });
      current = id;
    });
    queue = next;
    return next;
  }
  return {
    select,
    clear() { requested = null; },
    async assert(userId) {
      const id = String(userId);
      await queue;
      if (requested !== id || current !== id) throw new Error('Your account changed. Reopen the purchase screen.');
    },
  };
}

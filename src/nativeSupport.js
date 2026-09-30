// Store calls are injected so account isolation and product validation can be tested.
export const SUPPORT_PRODUCTS = Object.freeze({
  3: 'com.gotonespare.app.support.small',
  5: 'com.gotonespare.app.support.medium',
  10: 'com.gotonespare.app.support.large',
  founder: 'com.gotonespare.app.founder.v2',
});
export function createNativeSupport({ purchases, apiKey, userId, account = null }) {
  if (account ? (!/^[1-9]\d*$/.test(String(userId)) || !Number.isSafeInteger(Number(userId))) : !/^support-sandbox-[a-f0-9-]{36}$/i.test(userId)) throw new Error('A separate sandbox identity is required.');
  let ready, pending = false;
  const products = new Map();
  async function init() {
    if (account) { await account.assert(userId); return; }
    if (!ready) ready = purchases.configure({ apiKey, appUserID: userId }).catch(error => { ready = undefined; throw error; });
    await ready;
  }
  async function exclusive(action) {
    if (pending) throw new Error('A purchase or restore is already in progress.');
    pending = true;
    try { await init(); return await action(); } finally { pending = false; }
  }
  return {
    async load() {
      await init();
      const result = await purchases.getProducts({ productIdentifiers: Object.values(SUPPORT_PRODUCTS), type: 'NON_SUBSCRIPTION' });
      products.clear();
      for (const product of result.products) if (Object.values(SUPPORT_PRODUCTS).includes(product.identifier)) products.set(product.identifier, product);
      return Object.fromEntries(Object.entries(SUPPORT_PRODUCTS).map(([key,id]) => [key,products.get(id)?.priceString || null]));
    },
    purchase(key) {
      return exclusive(async () => {
        const product = products.get(SUPPORT_PRODUCTS[key]);
        if (!product) throw new Error('This purchase is not available from the App Store yet.');
        if (account) await account.assert(userId);
        const result = await purchases.purchaseStoreProduct({ product });
        if (account) await account.assert(userId);
        if (key === 'founder' && !result.customerInfo?.entitlements?.active?.founder) throw new Error('Purchase received. Founder recognition is still being verified; use Restore purchases before trying again.');
        return result;
      });
    },
    restore() {
      return exclusive(async () => {
        const { customerInfo } = await purchases.restorePurchases();
        if (account) await account.assert(userId);
        return !!customerInfo?.entitlements?.active?.founder;
      });
    },
  };
}

import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { createPurchaseIdentity } from './purchaseIdentity';

// Public (client-safe) RevenueCat API keys — one per store, since each
// platform's key is tied to its own app entry in the RevenueCat project.
const REVENUECAT_API_KEYS = {
  ios: 'appl_TgridhdUrSWzKOGYKbHwdgowyRT',
  android: 'goog_dWNiLcMIPMjNdgjokErkgbbZuVx',
};

// Product identifiers also differ per store — Apple uses the app's
// reverse-DNS bundle style, Google Play has its own separate naming rules.
const FOUNDER_PRODUCT_IDS = {
  ios: 'com.gotonespare.app.founder.v2',
  android: 'founder_membership',
};

let accountIdentity;
function identity() {
  const apiKey = REVENUECAT_API_KEYS[Capacitor.getPlatform()];
  if (!Capacitor.isNativePlatform() || !apiKey) throw new Error('Native purchases are unavailable.');
  if (!accountIdentity) accountIdentity = createPurchaseIdentity(Purchases, apiKey);
  return accountIdentity;
}
export async function configureRevenueCat(appUserId) {
  if (!Capacitor.isNativePlatform()) return;
  try { await identity().select(appUserId); } catch { /* Purchase screen reports unavailable account initialization. */ }
}
export function clearPurchaseAccount() { accountIdentity?.clear(); }

// Fetches the explicit Founder product and purchases it for the signed-in account.
// StoreKit/Google Play Billing throws on failure; the error has
// `userCancelled` set when the user simply dismissed the native purchase sheet.
export async function purchaseFounderPackage(userId) {
  const account = identity();
  await account.assert(userId);
  const productId = FOUNDER_PRODUCT_IDS[Capacitor.getPlatform()];
  const { products } = await Purchases.getProducts({ productIdentifiers: [productId], type: 'NON_SUBSCRIPTION' });
  const product = products.find(item => item.identifier === productId);
  if (!product) throw new Error('Founder membership is not available right now.');
  await account.assert(userId);
  const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
  await account.assert(userId);
  return customerInfo;
}

export async function restoreFounderMembership(userId) {
  const account = identity();
  await account.assert(userId);
  await account.assert(userId);
  const { customerInfo } = await Purchases.restorePurchases();
  await account.assert(userId);
  return !!customerInfo?.entitlements?.active?.founder;
}

// Only used by the explicitly enabled, isolated native sandbox screen.
let sandboxClientPromise;
let sandboxUserId;
export async function createSandboxSupportClient(userId) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') throw new Error('Open the iPhone test build to use Apple purchases.');
  if (sandboxUserId && sandboxUserId !== userId) throw new Error('Restart the test app before changing its sandbox identity.');
  sandboxUserId=userId;
  if(!sandboxClientPromise) sandboxClientPromise=import('./nativeSupport').then(({createNativeSupport})=>createNativeSupport({ purchases: Purchases, apiKey: REVENUECAT_API_KEYS.ios, userId })).catch(error=>{sandboxClientPromise=undefined;throw error;});
  return sandboxClientPromise;
}

// Created only by the release-gated Support screen, never by fixture previews.
export async function createAccountSupportClient(userId) {
  if (Capacitor.getPlatform() !== 'ios') throw new Error('Apple support purchases require the iPhone app.');
  const { createNativeSupport } = await import('./nativeSupport');
  return createNativeSupport({ purchases: Purchases, apiKey: REVENUECAT_API_KEYS.ios, userId, account: identity() });
}

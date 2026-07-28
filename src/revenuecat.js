import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// Public (client-safe) RevenueCat API keys — one per store, since each
// platform's key is tied to its own app entry in the RevenueCat project.
const REVENUECAT_API_KEYS = {
  ios: 'appl_TgridhdUrSWzKOGYKbHwdgowyRT',
  android: 'goog_dWNiLcMIPMjNdgjokErkgbbZuVx',
};

// Product identifiers also differ per store — Apple uses the app's
// reverse-DNS bundle style, Google Play has its own separate naming rules.
const FOUNDER_PRODUCT_IDS = {
  ios: 'com.gotonespare.app.founder',
  android: 'founder_membership',
};

let configured = false;

// Sets the RevenueCat app_user_id to our own numeric user id, so the
// backend webhook can map a purchase straight back to a users.id row
// with no separate identity-linking step.
export async function configureRevenueCat(appUserId) {
  if (!Capacitor.isNativePlatform() || configured || !appUserId) return;
  const apiKey = REVENUECAT_API_KEYS[Capacitor.getPlatform()];
  if (!apiKey) return;
  try {
    await Purchases.configure({ apiKey, appUserID: String(appUserId) });
    configured = true;
  } catch (err) {
    console.log('[RevenueCat] configure failed:', err.message);
  }
}

// Finds the Founder package in the current offering and purchases it via
// StoreKit/Google Play Billing. Throws on failure; the error has
// `userCancelled` set when the user simply dismissed the native purchase sheet.
export async function purchaseFounderPackage() {
  const productId = FOUNDER_PRODUCT_IDS[Capacitor.getPlatform()];
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current || Object.values(offerings.all)[0];
  const pkg = offering?.availablePackages.find((p) => p.product.identifier === productId);
  if (!pkg) throw new Error('Founder membership is not available right now — please try again shortly.');
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}

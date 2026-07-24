import { Purchases } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// Public (client-safe) RevenueCat API key for the iOS app.
const REVENUECAT_IOS_API_KEY = 'appl_TgridhdUrSWzKOGYKbHwdgowyRT';
const FOUNDER_PRODUCT_ID = 'com.gotonespare.app.founder';

let configured = false;

// Sets the RevenueCat app_user_id to our own numeric user id, so the
// backend webhook can map a purchase straight back to a users.id row
// with no separate identity-linking step.
export async function configureRevenueCat(appUserId) {
  if (!Capacitor.isNativePlatform() || configured || !appUserId) return;
  try {
    await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY, appUserID: String(appUserId) });
    configured = true;
  } catch (err) {
    console.log('[RevenueCat] configure failed:', err.message);
  }
}

// Finds the Founder package in the current offering and purchases it
// via StoreKit. Throws on failure; the error has `userCancelled` set
// when the user simply dismissed the native purchase sheet.
export async function purchaseFounderPackage() {
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current || Object.values(offerings.all)[0];
  const pkg = offering?.availablePackages.find((p) => p.product.identifier === FOUNDER_PRODUCT_ID);
  if (!pkg) throw new Error('Founder membership is not available right now — please try again shortly.');
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return customerInfo;
}

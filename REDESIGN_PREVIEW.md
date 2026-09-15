# Got One Spare? — redesign review

This checkout is `codex/ui-redesign`, based on frontend commit `69ad8aa`. The original frontend checkout and backend application code have not been edited. Nothing has been pushed or deployed.

## Design

The approved navy/yellow illustrated direction is implemented across the home dashboard, album collection, matching, swap details, navigation, shared controls and supporting screens. Desktop uses a side navigation; phones use five bottom tabs. Light/dark styling shares the existing theme preference. Manual sticker entry remains manual; no scanning feature has been invented.

The fixture checklist uses fictional player names and numbered album pockets. Cards render the existing description, sticker number and team accent; generated player portraits are no longer used in the collection. The home illustration remains decorative.

## Run locally

From this directory, run `npm ci`, then `npm run dev`. Open http://127.0.0.1:5174/ . No API environment variable is needed or accepted in preview. The default build is also a fixture preview, even though Vite calls its optimization mode “production”.

The yellow ribbon identifies fictional data. Reset restores the demo login and reloads fixtures. Inventory, swaps and messages are held in memory and reset on reload. No actual messages are delivered. Do not enter real credentials or personal information.

Network safeguards initialize before App imports: fetch/XHR/beacon and service workers are blocked; external navigation is suppressed; native push/open tracking and purchases are disabled. CSP allows only local app connections and designated static font/icon hosts. Storage is prefixed `gos-preview:`. Unknown fixture endpoints fail closed.

An eventual release build requires BOTH `VITE_APP_ENV=production` and an explicit HTTPS `VITE_API_BASE_URL`. This configuration was not launched or deployed. Release environment setup and full integration verification remain separate work.

## Validation

`npm test` runs six focused checks: preservation of API contract and sensitive utility code, fail-closed environment configuration, isolated/resettable inventory mutations, profile/notification/proposal contracts, separate messaging fixtures, and runtime outbound-network guards. These are not backend integration tests.

`npm run build` passes. Browser checks cover home and matches at desktop/mobile sizes, collection quantity/search, second-album selection and manual need entry. On 2026-09-13, checked the redesigned collector profile, mobile settings layout and fixture save, inbox/conversation and local message submission, support dialog, and light/dark switching. Full swap lifecycle, all dialog states, backend integration and native runtime remain unverified. No complete network capture or simulator runtime pass has been performed.

## iOS fixture packaging

Run `npm run build`, then `npm run ios:preview:sync`. The sync helper verifies preview CSP and rejects known production endpoints, temporarily uses preview Capacitor identity, restores the root release config, verifies fresh native HTML and writes a separate ignored preview Info.plist. Native project/signing/version files remain untouched.

Compile without signing:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath /tmp/got-one-spare-redesign-build \
  PRODUCT_BUNDLE_IDENTIFIER=com.gotonespare.app.preview \
  INFOPLIST_FILE="$PWD/.preview-ios/Info.plist" \
  CODE_SIGNING_ALLOWED=NO build
```

Unsigned simulator compilation passed on 2026-09-13 using Xcode 26.6. The resulting App.app reports bundle ID `com.gotonespare.app.preview` and display name `Got One Spare Preview`; its bundled HTML matches the current web build. The build log is `/tmp/gos-redesign-xcode.log`. No simulator was installed or launched.

This is not an archive or submission. Use only the preview identity for any future simulator installation. Generated native assets are ignored and must be rebuilt/resynced after UI changes. Backend integration, push/payment verification, physical-device signing, TestFlight and deployment are not part of this preview.

## Follow-up — 2026-09-13

Added the approved logo direction to the native app icon and centred the transparent wordmark on a navy launch storyboard; aligned Capacitor splash background. Login/signup use the navy/yellow theme with a simplified portrait-free background, and the login screen was inspected in the browser. Native changes are in this isolated checkout only. Sticker alternatives proposed: numbered album pockets (recommended), team-colour cards, or compact checklist; the subsequently approved numbered pockets are implemented below.

## Sticker pockets — approved and implemented

Replaced generated player portraits with numbered album pockets, full sticker descriptions, and team accents. Needs use dashed pockets with WANTED labels; spares retain quantity controls. Match illustrations now use neutral card backs. Existing hero artwork is unchanged. Browser-checked spares and needs; six tests and web build pass; latest assets synced into the iOS preview. Fictional names remain fixture data.

## Remaining screens — 2026-09-13

Refreshed collector profiles with a navy identity header and swapping statistics; rebuilt settings into profile/address, preferences, journey and account sections with a persistent Save footer. Updated inbox and conversation cards, collector search, swap history, active-swap cards, shared picker/rating/dispute/proposal/message dialogs, notification tray, support form, and password-reset/email-verification surfaces. Existing callbacks and API contracts are retained. Six checks and the web build pass; the latest fixture assets are synced for unsigned iOS compilation.

## Collector editions and palette — 2026-09-13

Replaced green primary accents with navy/blue in both themes, including secondary action buttons and home statistics. Semantic success styling remains green. Album covers now share straight navy layouts, aligned emblems, gold season numbers and subtle border/foil detailing. Verified home shelf and compact collection cover visually on mobile; six tests and web build pass, and updated assets are synced into the iOS preview. Native compilation was not repeated for this CSS/cover update.

## Final consistency pass

Updated swap-detail status/progress and photo-upload graphics, settings level/referral/availability labels, shared dialog typography, support/privacy branding and manifest colours/description. Browser confirmations are now asynchronous native HTML dialogs with unchanged warning text and action callbacks; Cancel is focused, Escape cancels and focus is restored. Confirmed withdrawal cancellation in the isolated browser without mutating the swap. All six contract/preview tests and web build pass. Native runtime and every conditional dialog state have not been tested.

## Integration testing

See ../integration-test/README.md for the new separate localhost:5175 database-backed environment and actual per-album catalogue snapshots. The default localhost:5174 fixture preview remains unchanged. Integration builds are also test-only; never archive them for release.

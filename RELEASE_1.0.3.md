# iOS 1.0.3 release preparation

Prepared in frontend-redesign, not the original frontend checkout. Version 1.0.3, build 7 (local previous build was 6; confirm App Store Connect has not already used 7).

Open `/Users/tom/Documents/Got One Spare/frontend-redesign/ios/App/App.xcodeproj` in Xcode. The bundled web assets are production assets, synced with Capacitor, with bundle ID `com.gotonespare.app`. Do not run `npm run build` alone before archiving: that defaults to fixtures and would replace the release assets.

To rebuild explicitly:
```
VITE_APP_ENV=production VITE_API_BASE_URL=https://panini-swap-production-69ef.up.railway.app/api npm run build
./node_modules/.bin/cap sync ios
```

Select scheme App and Any iOS Device. Confirm Signing & Capabilities uses the existing team and bundle ID, then Product > Archive. In Organizer choose the newly created 1.0.3 archive, Distribute App > App Store Connect and upload. Once Apple processes it, select this build on the existing 1.0.3 draft. Check review details, screenshots and release selection before submitting.

No archive has been uploaded by Codex. Website deployment is separate and has not been performed.

## What's New

A fresh new look for Got One Spare!

- Redesigned screens with clearer navigation and a new app icon.
- Browse your collection with refreshed album artwork and sticker cards.
- Add spares and missing stickers team by team, then save your selections together.
- Updated profiles, notifications and swap screens make keeping track of your swaps easier.

## Verification and limits

Seven frontend automated tests passed. Local API tests covered matching SQL and swap transitions, messaging and authorization using disposable accounts and a reconstructed local schema. Native simulator login, separate album catalogues, and saving a spare and need in each album passed. World Cup test entries: MEX2 spare and MEX3 need. Premier League: 22 spare and 21 need. These are local test changes only.

The production web bundle was inspected for the intended API URL, absence of the local API/demo token, correct native bundle ID and identical synced HTML. Production mode was not launched against live data.

Initial simulator startup was slow; cause not established. Physical-device camera/push, live database function parity and every conditional UI path have not been verified. This is not a claim of full release sign-off. Test the uploaded build on a physical phone through TestFlight before final review submission where possible.

Unsigned Release/iphoneos compilation passed on 14 September 2026. Compiled bundle metadata verified: com.gotonespare.app, version 1.0.3, build 7. Signing/archive validation and Apple processing remain separate steps.

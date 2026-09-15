# Design asset provenance

Generated with OpenAI image generation for the user-approved Got One Spare? redesign on 2026-09-12. No downloaded player photos or collection logos are used.

- `hero.png`: navy football stadium illustration, empty area on the left for live HTML copy, tilted blue/red fictional football sticker artwork on the right.
- `players.png`: six fictional football portraits in a 3×2 atlas, varied kit colours, used by CSS only for synthetic preview records. The player names in fixtures are fictional labels, not identified real people.
- `wordmark.png`: transparent white/navy “Got One Spare?” lettering with a yellow question mark, matching the approved illustrated direction.

These descriptions record the asset briefs rather than claiming to reproduce the complete generation prompts. Source generated files were exec-a1f43fd4-eea8-4bee-b5d3-2886dd2f1fbd.png, exec-688c31cf-297d-40cb-8adb-84f48c1d29bc.png, and exec-b56db1df-7c56-4ca9-9300-67e66e772362.png in the task's generated_images folder. Album covers are rendered in CSS with Lucide trophy/shield icons.

## iOS branding update — 2026-09-13

Built-in image generation produced `ios-icon-source.png`; native packaging resized it to `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024×1024, opaque). The launch screen reuses the original transparent wordmark in `LaunchLogo.imageset/wordmark.png`, centred on navy by native layout constraints.

Final generation prompt: “Use case: compositing. Edit target: attached approved Got One Spare? wordmark. Create the iOS app icon using this SAME logo, preserving the exact lettering, white letters, navy outline, blue edge and yellow question mark. Place the complete logo centered on a solid deep navy #082D58 background, logo occupies 86% of canvas width, with generous space above and below. Output exactly 1024x1024 square opaque PNG. Fill entire canvas to edges. No rounded corners (iOS applies its own mask), no phone mockup, no additional symbols, no players, no tagline. Do not redesign the wordmark.”

Source: exec-890ea419-44b4-4885-96d9-452d138771ab.png. The generated source was 1254×1254; sips performed only the required native icon size conversion.

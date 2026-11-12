# Oh My Ink - Live AI Tattoo Experience — iPad Event Setup

Use a published HTTPS web app on the iPad; do not copy the source ZIP onto it. The app runs in Safari and can be added to the Home Screen. Native Expo Go, TestFlight and App Store installation are not required for this web version.

## Publish the web app first

The checked project currently has a working development Preview, but the platform reports `app_not_published` and an older failed deployment record. No successful permanent event URL has been confirmed. Asking how to deploy does not authorize an actual publication, so no publication is performed in this guide.

Publish the latest saved project version through its website Publish workflow and wait for confirmed success. If deployment fails, inspect and resolve that failure before an event. The current project has a Dockerfile that builds the exported web interface and Express API together. Production must retain MySQL, authorized object storage credentials and the original catalog PNG directory. Uploading only static HTML is insufficient for matching requests, protected downloads and artist preparation. The production server honors PORT and serves `/api/health`; the browser should use the same-origin API over HTTPS.

## Add it to the iPad Home Screen

1. Connect the iPad to stable Wi-Fi and open the confirmed permanent HTTPS site in Safari, outside the embedded development Preview.
2. Tap Share. If shown, tap View More, then Add to Home Screen.
3. Turn on Open as Web App when this option is available. Confirm the displayed name and tap Add. The icon appears on this iPad only. Repeat on each event device.[1]
4. Open the new Home Screen icon and test collection browsing, guest options, original design selection and the team-handoff screen before handing it to guests.

## Keep the device in the event app

In Settings → Accessibility → Guided Access, enable Guided Access and set a staff-held passcode. Open the event web app, triple-click the iPad's top button or Home button on older models, choose Guided Access if prompted, and start the session. Leave Touch and Software Keyboards enabled so guests can make choices and enter prompts. Adjust Display Auto-Lock for the event, keep the iPad powered and avoid disabling touch across the entire screen. End or pause a session using the configured button/passcode flow; older iPadOS versions may use a different click count.[2]

Guided Access prevents leaving the app but is not application authentication. It does not automatically hide My designs or Artist settings. This app's artist tools are presentation separation, not a protected staff role. For completely unattended guest kiosks, a proper guest-only/staff-authenticated mode is still needed. Staff can also configure unavailable screen areas in Guided Access, but that is a device-level restriction and must be tested against the responsive layout.

## Run the event

Guests browse or find original catalog designs, choose a design, and show the artwork to the team. A selection does not automatically notify a staff queue, print, or apply a design to a skin/photo/hardware try-on. The team guides the physical temporary tattoo experience. Staff start a fresh journey for the next guest and keep private apps/notifications away from the kiosk.

The current web app is not an offline app. Catalog requests, job updates and original/artist-file downloads need a connection; adding a Home Screen icon does not change that. Use event Wi-Fi with a tested backup connection, a stable iPad stand and continuous power. Test the final published origin because history and credentials are browser/origin-specific; do not expect Preview history to migrate automatically. Shared-device history can expose earlier guest searches, and clearing local history removes local access, not server data.

If printing is used, staff explicitly open Artist tools and test the real iPad/printer combination before the event. Use a compatible system print/AirPrint path or a printer-specific bridge where needed. Disable printer-side mirroring because the preparation file is already mirrored once. A browser print dialog is not proof of a physical print, and the cloud API cannot directly see a printer on the venue's local network.

Freeze the tested published version during the event. The managed database is shared with development, so avoid Preview-side data tests or backend changes while guests are using production. Verify every event iPad after any device or deployment change rather than assuming desktop Preview proves device readiness.

## References

[1]: https://support.apple.com/zh-hk/guide/ipad/ipadc602b75b/ipados "Apple — Add a website icon to the iPad Home Screen"
[2]: https://support.apple.com/en-us/111795 "Apple — Use Guided Access on iPhone or iPad"

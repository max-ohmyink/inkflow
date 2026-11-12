# Oh My Ink - Live AI Tattoo Experience — Web App Guide

## Current event-facing version

The browser app uses the supplied Bloomberg Day 2026 toolkit’s bright Waterworks artwork and Avenir/Bloomberg font files while keeping Oh My Ink’s unchanged logo, native identities and app icons. A cream/cyan/pink/yellow poster-and-action layout works on iPad landscape, desktop and narrow phones. Open it in Safari, Chrome or Edge; the web version does not need Expo Go, APK, TestFlight or native installation.

The exact prompt heading remains **Generate your tattoo live!**. Guests enter an idea or leave it blank for Surprise me, choose **Simple outlines**, **Fine line** or **Playful line art**, and open **Color mix** to pick up to three tattoo inks. There is no Category selector in the form. Gallery collection browsing remains within the current simple family edit.

## Simple family designs, catalog first

New family-event work uses nine curated authentic source motifs: Moon with Leaf, Heart with Arrow, Heart-shaped Clip, Dog Balloon, Ribbon, Smile Daisy, Fine Line Flower, Fine Line Tulip and Fine Line Rose 1. The full 451-record original library across 30 collections is retained for provenance and archived jobs; complicated designs are not offered for new event requests. Mandalas, dense ornament, scary/gory/explicit/weapon themes and complicated style directions are excluded from new work. The scope is an event design brief, not a safety/age certification or fixed drawing-time guarantee.

The server checks suitable theme/art-style catalog matches first and returns up to four real options without unrelated or AI padding. Only a valid free-text no-match request uses AI to create four friendly minimal-line outline variations. Exact gallery IDs choose the original catalog record; invalid/mismatched IDs do not trigger a silent AI replacement. Source labels identify catalog, AI-created and archived/legacy artwork truthfully. Already accepted owned idempotent requests recover before the new-work family guard, so archived credentials are not lost.

## Your physical tattoo inks

The 20 English choices follow the uploaded ink reference: Cool Purple, Purple, Warm Purple, Rose Pink, Red, Cherry Red, Deep Red, Rust Red, Brown, Black, Lemon Yellow, Apricot Yellow, Orange, Light Green, Green, Dark Green, Lake Blue, Sky Blue, Navy Blue and Tattoo Blue.

The original photo-derived RGB references remain stored separately from a brighter digital display palette. New custom images and visible swatches use the brighter mapping; neither is physical ink calibration, a manufacturer specification or skin-safety advice. Staff should confirm actual materials, placement and the physical ink choice. Select one to three inks; remove one to choose another once three are selected. **Keep original colors** clears the custom palette. Requested ink IDs are validated and preserved through submission, reconnection and catalog/AI metadata. The selected-design screen displays these as requested inks—not confirmation that a digital color version succeeded.

New selected custom inks use direct region-limited fill with the brighter selected palette, without an AI color-service call. Internal analysis may infer bounded small contour gaps, without drawing new black strokes, to recover more enclosed subject areas. Wide ambiguous openings remain a limitation; the analyzer must not paint broad rectangular/hull backgrounds. Contours, lettering, original dimensions and white exterior remain protected. Black-only custom selection uses the local monochrome path. Original/default and archived color modes remain readable without automatically recoloring saved artwork. Start a new request to receive the updated digital version.

## When requested colors are unavailable

The earlier ImageService restriction is not changed or claimed resolved by this theme/palette update. A previous bounded diagnostic returned HTTP 400/failed_precondition with “your account has hit a usage exhausted”; support confirmed overall Manus credits were not empty but did not identify that image-service restriction’s cause. This guide does not infer balance, cost, reset time or restoration. Do not repeatedly submit new generation requests as a health check.

An unsuccessful optional color version has persisted unavailable status, a prominent English notice and no color URL. The original and original-derived artist files remain usable; successful sibling color versions stay available. The app never labels originals as successful requested colors. Source-generation/storage/preparation failures remain genuine errors. Original colors and black-only/monochrome catalog preparation do not require a new image-model call; new AI fallback originals and older proposal modes do. Contact [Manus help](https://help.manus.im) for the managed image-service restriction when needed. No alternate provider or account change was silently introduced.

## Guest handoff and artist preparation

Guests select a design and show the screen to the team for the non-permanent, needle-free tattoo moment. The app does not notify a staff queue, create a photo, complete a skin try-on, automatically print or physically apply a tattoo. Staff review and simplification are still necessary.

Guest preview defaults to a ready color version when present, can compare the untouched catalog/AI original and saves the explicitly displayed version. Artist tools use the uncolored original to create exactly-once horizontally mirrored PNG and optional SVG. Do not enable a second printer/driver mirror. Default width is 60 mm, with 40/80/100 mm choices. Preserve aspect ratio and test real equipment; DPI metadata does not add native resolution. Browser dialogs do not confirm physical printing or reliably distinguish Print from Cancel. Artist tools are presentation separation, not authenticated staff access.

## History, recovery and security

Views are `/`, `/?view=designs` and `/?view=settings`, with browser Back/Forward. Access credentials/history stay per browser and origin; another/private browser does not share them. Clearing history intentionally removes local access without deleting server records.

Submission stores request IDs/tokens and choices before the first network call. An uncertain pending request blocks a different new request from overwriting its credential; reconnect uses the same owned request. Versioned metadata preserves source choice, filters, selected inks and actual per-option fill treatment. Malformed versioned metadata fails closed. Older assets remain readable with neutral treatment labels where actual outcomes were not recorded. Provider work is not automatically retried; an explicit new retry is new work.

Source/color/artist assets are capability protected. Provider/storage credentials remain server-only. The worker has client/total concurrency two and a single-instance process queue; startup fails orphaned active work instead of repeating uncertain provider calls. Internet is required. No service worker/offline artwork cache is added.

## Build, publication and event iPad setup

Development listeners remain fixed at Web 8081 and API 3000. Use `pnpm dev`, or run `pnpm dev:metro` and `pnpm dev:server` independently. `pnpm check`, `pnpm test`, `pnpm build:web`, `pnpm build` and `pnpm build:all` are available. `node scripts/verify-web-export.mjs` checks title, owned manifest, icons and declared routes. Docker serves exported web output and `/api` from one origin, includes catalog PNGs, honors `PORT` (default 3000) and exposes `/api/health`. Runtime requires MySQL and authorized Manus image/storage credentials; older proxies may need `PUBLIC_WEB_ORIGIN`.

Preview, source saving, publication and real equipment readiness are separate. No confirmed public HTTPS deployment or physical iPad/printer result is claimed by this update. For event operation, publish successfully to a permanent HTTPS URL, open it in iPad Safari, use Share → Add to Home Screen, and enable Open as Web App if offered. Guided Access can limit guests to the app; set a staff-held passcode and keep a staff exit route. Plan reliable Wi-Fi plus backup internet, power/charging, daily device checks and shared-history/staff-setting procedures. See `IPAD-EVENT-SETUP.md` for the verified Apple setup guidance.

Keep full source PDFs/photos/font archives, `.env`, signing keys and capability caches out of public/Git delivery. Only approved source artwork crops, used unchanged font files and derived ink data are included. See `EVENT-THEME.md`, `TATTOO-INKS.md`, `FAMILY-DESIGNS.md` and the source/provenance reports for exact boundaries.

## Four style directions

The Art style menu offers Fine Line, Old School, Traditional and Watercolor. Catalog match remains the unchanged optional default, and legacy saved profiles keep their identity. Applicable source labels are checked first; Old School and Traditional can share genuine classic-flash labels. No compatible catalog style means a real style-specific AI fallback, not a pretend source restyle. Family/mandala exclusions stay in place.

Watercolor is a digital soft-wash original, shown first rather than its flat selected-ink alternate. The comparison action identifies Flat ink version. Our artist may simplify digital washes for instant hand drawing; no physical watercolor or fixed drawing-time guarantee is implied. Generating new AI originals still needs an available image service; the earlier restriction is not claimed resolved by menu/prompt tests. Local selected-ink fills and bright digital swatches do not call that provider.

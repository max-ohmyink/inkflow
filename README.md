# Oh My Ink - Live AI Tattoo Experience

A browser-first family-event tattoo studio using the supplied Bloomberg Day 2026 artwork/fonts and Oh My Ink’s unchanged original logo. The light cyan/pink/cream/yellow layout works on iPad, desktop and phones. The retained Expo scaffold opens directly in Safari, Chrome or Edge; the web version needs no Expo Go or App Store installation.

## Guest experience

**Generate your tattoo live!** retains a prompt, Art style and Color mix, with no Category form selector. The style menu offers **Fine Line, Old School, Traditional and Watercolor**, while the unchanged Any art style default leaves the style open. Every request creates new AI originals (the artist catalog has been retired); old catalog jobs are no longer generated. Family/mandala exclusions remain, and classic Old School/Traditional source labels can overlap without inventing provenance.

Watercolor is a digital color-wash direction. Its painted original is shown first; a selected-ink alternate remains a flat local fill, not watercolor texture. Our artist may simplify the look for live drawing. New AI style creation still requires an available image service; no restoration or generation success is claimed merely from prompt tests.

The Color mix picker offers 20 English ink names, choosing up to three. Original photo-derived reference HEX values remain stored separately from a brighter digital screen palette. New local custom fills recover bounded small contour gaps and retain source strokes and white exterior; Tiger coverage improves from 6,509 to 18,515 colored pixels. Physical inks may look different. IDs persist through submission, recovery and source metadata. Black-only remains local monochrome; old ready files are never automatically recolored. Originals, color versions and original-derived mirrored artist files stay separate.

## Develop and build

```bash
pnpm install --frozen-lockfile
pnpm dev          # Expo Web 8081 and API 3000
pnpm check
pnpm test
pnpm build:all    # web-build and dist
```

The listeners can run independently with `pnpm dev:metro` and `pnpm dev:server`. Docker serves web output and `/api` from one origin, honors `PORT` (default 3000) and exposes `/api/health`. Runtime needs MySQL and an AI image provider API key (see `.env.example`). Full confidential PDFs/photos/font archives, credentials and capability caches are not delivered as public assets.

## Preservation and event operation

The full 451-record library remains for provenance and archived work; the simple family pool is used for new event requests. Guest selection shows a team handoff, not an automatic print, notification, skin/photo try-on or physical tattoo application. Artist preparation derives from the original and mirrors exactly once. Check real iPad/printer sizing, ink materials and extra driver mirroring. Artist settings are not authenticated staff access.

History/access are per browser and origin. Lost responses reconnect using the same pre-saved request ID/token, and a different request cannot overwrite uncertain credentials. Provider work is not automatically retried. The single-instance worker has concurrency two and startup orphan handling. Internet is required; Home Screen installation does not make generation offline.

Use Preview for the current app. Successful permanent HTTPS publication remains separate before iPad Safari Share → Add to Home Screen and optional Guided Access. No public deployment or physical print readiness is claimed.

See `docs/STYLE-DIRECTIONS.md`, `docs/GAP-AWARE-COLOR.md`, `docs/TATTOO-INKS.md`, `docs/WEB-APP-GUIDE.md`, `docs/EVENT-THEME.md`, `docs/FAMILY-DESIGNS.md`, `docs/IPAD-EVENT-SETUP.md` and `docs/VALIDATION.md`. Decorative event artwork is not a tattoo-generation reference.

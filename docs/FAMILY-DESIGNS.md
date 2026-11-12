# Family designs

New event work is intentionally limited to a deterministic, child/family-friendly catalog pool. The original catalog files remain untouched.

## New catalog pool

New gallery browsing, text matching, Surprise me, and exact-ID selection may use only these IDs, in this order:

1. `moon-with-leaf`
2. `heart-with-arrow`
3. `heart-shaped-clip`
4. `dog-balloon`
5. `ribbon`
6. `smile-daisy`
7. `fine-line-flower`
8. `fine-line-tulip`

The gallery’s collection options are derived only from those records: Above The Sky | Sun, Moon & Angel; Sacred Pulse | Hearts; Happy Arcade | Smileys & Toys; and Petal & Vine | Fine Line Flowers & Leafs.

New family art-style filter IDs are exactly `any`, `fine_line`, and `illustrated`. The parser continues to understand historical art-style values so old saved metadata can still be read.

## New-work safety policy

After an idempotency-owned request has been recovered, and before concurrency checks, persistence, queueing, or any image work, a new request is rejected when it uses an unsupported family art style or asks for unsuitable content. The guard excludes dense/complicated designs (including mandalas and complicated roses), melted or sad smiles, scary masks, skulls, monsters, gore, weapons, and sexual/explicit content.

AI fallback is still catalog-first and used only for valid zero-match free text. Its generation brief is always a simple, friendly, single child-appropriate motif with few clean strokes and explicit negative constraints against dense detail, scary or graphic content, weapons, sexual/explicit content, and mandalas. The fallback brief does not inherit a legacy style direction.

## Compatibility and color intent

The restriction is applied only to **new** selection and creation. Stored catalog metadata continues to resolve its validated IDs directly, including IDs outside this pool, so ready jobs and historical source/provenance remain available. Existing catalog files, storage objects, palette/source-priority fields, and parser support are not removed or rewritten.

For new and stored V3/AI jobs, the service keeps the complete filter object as the source decision. Optional selected ink colors from that filter are passed through as color-version intent separately from source artwork selection; source originals and artist stencil assets remain unchanged.

## Validation

`tests/family-designs.test.ts` verifies the exact pool/order, narrowed categories, the allowed art-style IDs, the fallback safety brief, duplicate-request recovery before family checks, and early rejection of unsupported/scary requests. It mocks repository/platform/image processing modules and makes no image, API, or database generation calls.

## Restored simple rose

Fine Line Rose 1 is included after visual confirmation of its simple contour. The current new-work pool has nine designs; normal rose requests now match this original before AI fallback. Intricate/detailed rose briefs remain excluded.

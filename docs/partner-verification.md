# Companion and persistent nest

Built from `bea0075` on feature branch `ao/sluger-2/partner`, for local integration into `/Users/marcusasplund/code/sluger` (`main`). No external services or new dependencies.

## Behavior

- A static wet trail branches into the left bed toward one resting companion. Its route appears on the map after discovery. Small foliage clearances make the trail and meeting readable.
- Hold the existing E/action button for two seconds nearby to meet. Both slugs turn/respond with their feelers. Movement or releasing E cancels incomplete progress. The garden remains dangerous; the meeting is optional.
- After meeting, three meals and at least 45% moisture unlock laying at home. E enters the protected pot sequence and gradually places six eggs, costing 20 moisture. “Shelter without eggs” preserves the ordinary victory option. Unpaired evenings retain automatic homecoming.
- A complete clutch is saved exactly once. Restart during incomplete laying removes previews but preserves earlier clutches. Nest totals persist in localStorage under `sluger.nest.v1`. Corrupt saves safely fall back to an empty nest; blocked writes preserve session progress and are labelled.
- Score formulas are unchanged. Eggs do not hatch. Up to twelve are rendered; the total remains recorded (save validation caps at 10,000 clutches).

## Verification

- `npm run build`: TypeScript and production build pass. Main bundle about 770 kB / 210 kB gzip; the existing Vite chunk-size warning remains.
- Full Playwright suite: **32 passed**. New tests cover discovery, meeting interruption/pause, optional ordinary victory, food/moisture gating, shelter-only choice, one-time deposit, score preservation, restart mid-deposition, reload persistence, corrupt/blocked storage and mobile controls with reduced motion. Rule tests include 30/60/144 Hz meeting progression.
- Existing beer escape test now exits toward the garden centre; its former fixed southward route could collide with randomly placed outer-edge rocks. Gameplay escape rules were not changed.
- `git diff --check`: clean.
- Inspected desktop screenshots of trail, meeting, nesting choice, saved eggs and result; inspected 390×700 mobile intro and too-dry choice. Visual runner captured no page errors. Generated evidence is in ignored `artifacts/partner-*.png` and `artifacts/partner-review-state.json`.
- AO preview/browser navigation and action commands were exercised. As earlier in this session, AO reported actions but returned stale snapshots; no successful AO screenshot is claimed. Visual verification used the Playwright images. Normal app preview is left open in AO.

## Measured performance

Installed desktop Chrome, headless, Balanced, 1440×1000 at DPR 1. Three-second warmup followed by five seconds of requestAnimationFrame intervals per scene, with ordinary gameplay/environment updates active. The companion sample includes holding E for the meeting; the nest sample displays a previously saved clutch. No concurrent test suite or source edits during measurement.

| Scene | FPS | p95 interval | Frames above 20 ms |
| --- | --- | --- | --- |
| Companion / meeting | 60.08 | 16.8 ms | 0 / 301 |
| Saved eggs in pot | 60.19 | 16.8 ms | 0 / 301 |

Evidence: `artifacts/partner-performance.json`; reproduce with `node tools/partner-benchmark.mjs` while serving port 5179. This measures short desktop frame pacing, not separate CPU/GPU time or sustained mobile performance. Trail geometry is created once (one mesh), eggs share an instanced mesh, and the companion reuses the existing slug animation implementation.

Visual fixtures: `http://127.0.0.1:5179/?test&review` (development only), or `node tools/partner-review.mjs`.

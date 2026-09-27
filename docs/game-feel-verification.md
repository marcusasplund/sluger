# Game-feel improvements — local verification

Workspace: `/Users/marcusasplund/.ao/data/worktrees/sluger/sluger-2`
Branch: `ao/sluger-2/root`
Preview: <http://127.0.0.1:5179/>

## Baseline provenance

The worker initially contained commit `13eb347` (first prototype). The intended game was uncommitted in `/Users/marcusasplund/code/sluger`. With explicit orchestrator authorization, 52 allowlisted game files were copied into the initially clean worker: tracked game/config edits and untracked source, public assets, tests and tools. Missing tracked paths were handled as deletions. No Git metadata, secrets, dependencies, build caches or unrelated local files were copied.

Before implementation, `/tmp/sluger-2-baseline` captured the source status, tracked binary diff, SHA-256 manifest and complete copied files. Portable copies are in ignored `artifacts/baseline-*` files. `artifacts/game-feel.patch` separates this implementation from the preexisting user work. All 52 original source files still matched their recorded hashes after verification. No commit, push or PR was made.

## Changes from that baseline

- `src/game/beer.ts`, `src/main.ts`: lure warning, weak attraction, controllable wobble, 2.4-second grace even at the bowl centre, directional escape using existing controls, recovery outside the hazard and death only after grace at the inner rim. Input is never reversed or disabled during escape. Pause freezes the window; reset clears exposure.
- `src/feeding.ts`, `src/world.ts`, `src/life.ts`, `src/main.ts`: visible tip-first bites, leaves bending toward the mouth, gradual loss of lettuce and a short satisfied body/eye reaction. Partial progress belongs to its food and does not regrow or transfer. Nutrition/score is credited once, only on completion. Existing food durations/values are unchanged. Restart restores all poses and geometry.
- `src/main.ts`, `src/sound.ts`, `src/style.css`: protected 1.6-second crawl into the pot, fading danger/motor/ambient sound, score count-up, existing food/risk/health bonus breakdown, and localStorage personal best. Existing `raidReward` formula is untouched. Pause, settings, restart and reduced-motion handling cover the transition. Storage failure keeps an in-session best without breaking gameplay.
- Tests cover the new behavior; old instant-death/instant-victory expectations were updated. Playwright uses isolated port 5179 rather than the original checkout's 5173.
- Dev-only `?test&review` fixtures permit short interactions to be stepped in the AO browser. Ordinary preview and production builds do not expose these controls. Review/benchmark scripts are under `tools/`.

## Verification

- `npm run build`: passed (existing-style warning: main bundle above Vite's 500 kB threshold; final bundle about 763 kB / 207 kB gzip).
- `npm test`: **22 passed**, 25.0 seconds. Covers normal play, touch layout, existing threats, beer escape and drowning, pause, interrupted food, single completion credit, restored geometry, home protection/count-up, persistent record after reload, unavailable storage, reduced motion and restart during homecoming.
- `git diff --check`: passed.
- Deterministic screenshots inspected: intact/partly eaten lettuce, beer warning, slug entering the pot, desktop result and 390×700 mobile result. Current screenshot runner reported no page errors. Files are in `artifacts/`.
- AO preview/browser navigation, snapshots and interaction commands were exercised. AO reported clicks but its snapshots remained stale; screenshot requests returned `SERVICE_UNAVAILABLE` while the panel was not available for painting. The user explicitly chose to continue other verification. **Visual inspection therefore used Playwright screenshots, not a successful AO screenshot.** Normal game preview was reopened in AO for handoff.
- Audio fade is implemented with Web Audio gain scheduling plus ambient volume reduction. Existing automated audio tests pass; no subjective listening assessment is claimed.

## Performance actually measured

Desktop headless installed Chrome, Balanced quality, active game with gardener/mower/environment updating and stationary slug, three seconds warmup then five seconds of `requestAnimationFrame` intervals per sample. Seeded randomness was used, but hazard layouts can differ because initialization consumes random values. This is a comparable scene, not a byte-identical GPU workload. No FPS conclusion is drawn from deterministic screenshots or fast-forward tests.

| Version | Viewport / device DPR | Actual render DPR | FPS | p95 frame interval | Frames >20 ms |
| --- | --- | --- | --- | --- | --- |
| Baseline | 1440×1000 / 1 | 1 | 60.11 | 16.7 ms | 0 / 301 |
| Updated | 1440×1000 / 1 | 1 | 60.06 | 16.8 ms | 0 / 301 |
| Baseline | 1728×1117 / 2 | 1.018 | 60.06 | 16.8 ms | 0 / 301 |
| Updated | 1728×1117 / 2 | 1.018 | 60.17 | 16.7 ms | 0 / 301 |

Eight actual lettuce meals with E held, at 1440×1000/DPR 1: **301 measured chewing frames, 60.01 FPS, p95 16.8 ms, no intervals above 20 ms**. The first interval after keydown was excluded. JSON evidence: `artifacts/feel-performance.json` and `artifacts/feeding-performance.json`.

Each lettuce uses one mesh/draw call. Only the active plant's cached position buffer changes; geometry, materials and textures are not recreated per frame. Beer text/meter updates are throttled to 10 Hz. Draw-call ranges vary with shadow/reflection frames: baseline 161–401, updated 158–392 in these samples.

These are short desktop frame-pacing measurements, not separate CPU/GPU timings or proof of sustained 60 FPS on mobile, every scene or High quality. Dynamic resolution remained enabled as in the existing game.

## Reproduce

Run `npm ci`, then `npm run dev -- --host 127.0.0.1 --port 5179 --strictPort` and `npm test`. `node tools/feel-review.mjs` captures deterministic visuals. `node tools/feeding-benchmark.mjs` measures actual meals. `node tools/feel-benchmark.mjs` additionally requires the preserved baseline served on port 5180.

## Subsequent local integration

At the user’s request, all verified project changes were integrated into `/Users/marcusasplund/code/sluger` on `main`, above baseline commit `d490bcc`. The implementation was originally committed as `9608fab` in the worker. The provenance and measurements above describe that earlier verification. No push or PR was made.

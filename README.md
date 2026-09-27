# Sluger

A playable stealth adventure at slug level. Fill your belly with three meals of lettuce, lilies, or a mixture of both, avoid the gardener and get home to the overturned pot. Evening light, dense vegetation, damp soil and oversized everyday objects turn the garden into a small world to explore.

## Run locally

```sh
npm install
npm run dev
```

Open the address printed by Vite. The game uses Three.js and WebGL2, with an English interface and keyboard, mouse and touch controls. No account or backend is required.

```sh
npm run build   # TypeScript + production build in dist/
npm test        # Game rules and integration tests in Chrome
```

Browser tests use a locally installed Google Chrome. Playwright starts a development server on port 5179 if needed. Screenshots are saved in `artifacts/` and failure reports in `test-results/`.

## How to play

| Control | Action |
| --- | --- |
| WASD / arrow keys | Crawl relative to the camera |
| Drag the mouse | Rotate the camera |
| Hold E near food / a companion | Eat or meet; stay still |
| E at home after a meeting | Lay eggs when fed and moist, then shelter |
| Ctrl / C | Sneak. Plants in the garden beds provide cover |
| Shift | Slide faster; consumes moisture |
| V | Switch between ground view and overview |
| Esc / pause button | Pause or resume |

Touchscreens have directional buttons, a contextual Eat / Meet / Nest button and Sneak. Drag the game view to rotate the camera.

- Eight white lilies and four pale lettuce heads with pink edges share the garden. Each meal fills one third of your belly. Lilies take 1.15 seconds, restore 9 moisture and earn 100 food points. Lettuce takes 0.65 seconds, restores 24 moisture and earns 40 food points.
- Eating leaves a visible stump only for lilies; the gardener can investigate these. Lettuce provides a quieter, lower-reward route home.
- Puddles restore moisture and gradually replenish health. Rain helps too.
- The back-right lawn contains two lilies and a robot mower. Its motor grows louder as it approaches. Watch its back-and-forth route and cross behind it; contact with the cutting deck is fatal. Short grass offers no sneak cover. The orange map dot marks the mower.
- Each round places two or three beer traps in a new combination of garden locations. Their scent pulls you in and leads to intoxication and drowning. Gold dots mark the bowls.
- Two patches of blue poison pellets are also randomly placed each round. Contact builds poison that keeps damaging health after you leave. Reach a puddle to wash it off; rain alone does not clear it. Cyan dots mark the bait, and the HUD shows the remaining poison.
- Salt appears as white grains on the ground and red markings on the map. It causes rapid damage.
- The gardener patrols, investigates movement and chases you when suspicion fills up. Pots and larger rocks block his view. Sneak among the plants to escape, but don't let him get too close.
- Once your fullness meter reaches 100%, you can return to the green home marker to end the raid. Keep eating for a bigger reward, at the risk of losing the run.
- Results award food points for both types, a growing risk bonus for valuable extra food, and a bonus for remaining health. All eight lilies earn the Garden legend rank.
- Eaten stems remain visible. The gardener investigates damage he sees, changing his route through the garden.
- The gardener pauses to raise his spade before striking. Move away from the aimed spot during the wind-up. Damage happens on impact, and fatal hits lead into the death animation.
- Winning and losing offer a restart that resets the entire round. Pausing, opening settings and switching to another browser tab stop gameplay.

## A companion and a nest (optional)

Look for a thin silver trail branching into the left flowerbed. Approaching it reveals its route on the map. Follow it to the resting companion and hold E for two seconds. Both slugs respond with their feelers. Releasing E or moving away interrupts the meeting, and the gardener and other hazards remain active.

After meeting, bring three meals and at least 45% moisture to the overturned pot. Press E to settle inside and lay six eggs, using 20 moisture. You can always choose **Shelter without eggs** once full, including when too dry to lay. Food and score rules are unchanged. Without meeting a companion, the existing automatic return home works as before.

Eggs appear gradually and are saved only when the clutch is fully laid. Restarting before that point cancels the new clutch; previously saved eggs remain. The nest and personal best survive restarts and reloads in the same browser/origin. If browser storage is blocked, new eggs remain for the current session and the result says so. The nest renders up to twelve eggs while recording the total laid. Eggs do not hatch in this first version.

## Graphics and performance

**Balanced** is the default: direct rendering with anti-aliasing, a starting budget of roughly two million rendered pixels, adaptive resolution and shadows updated 24 times per second. Gameplay and the camera update every frame. Resolution gradually drops when the frame rate falls below the target and recovers when there is headroom.

**High** adds bloom, an HDR post-processing pipeline and higher resolution. It is significantly more expensive, especially on Retina displays. **Low** disables shadows and limits pixel density.

Grass and ground details use instancing. Static plants and building parts are combined by material. Distant tree canopies use baked leaf clusters; clouds use a texture generated once at startup. These choices take inspiration from Tidewater's emphasis on atmosphere and density within a practical rendering budget.

Puddles share a periodically updated planar reflection. Stones use scanned color, normal and surface maps with procedural shapes and wetness. The slug has body and feeler animation; the gardener uses foot placement and joint animation.

With the development server running:

```sh
node tools/benchmark.mjs  # Isolate resolution, bloom, grass and shadows
node tools/verify.mjs     # Measure movement/rain and capture screenshots
```

`?test` exposes deterministic controls only in development builds. These let tests exercise an entire round without waiting several minutes. They are excluded from production builds.

## Limitations

This is one continuous garden level with a procedural environment and a licensed human model. It is not a port of Tidewater's WebGPU engine. Clouds are baked layers rather than volumetric. The gardener's walking animation and local obstacle avoidance are simplified; there is no navigation mesh. Garden beds define hiding places, rather than individual leaves. The current raid is not saved across reloads; the nest and personal best are stored locally.

The font may load from Google Fonts; system fonts provide a fallback. Other models, materials and audio are served locally. Sound is enabled by default and starts after interaction. Use the top corner button to mute it or adjust the volume in settings. Audio includes ambience, movement, action cues and stress sounds. Fatal spade attacks trigger a dismemberment effect before the defeat screen.

Model, texture and audio licenses are listed in [CREDITS.md](CREDITS.md).

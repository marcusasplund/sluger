# Family outings

Hatchlings remain sheltered for their first raid. A successful night transition matures the previous hatchlings, including across the three-night campaign boundary. Existing saves default to a sheltered first night. Up to six youngsters are simulated; any others remain in the pot.

Q and the visible Call young button gather them before food is complete. Gathering remains active for the raid. Full family provisions automatically start the return. Homecoming waits for all living outing youngsters to reach the pot. Pausing freezes simulation and danger timers.

Youngsters explore within about 2.4 metres of the parent. A youngster within the gardener's sight and 1.5 metres, beyond the safe nest area and over 1.2 metres from its parent, has six seconds to escape. Calling lets frightened youngsters move again; approaching them clears fear. Warning text, map markers and the existing gardener direction indicator expose the threat. Losses are saved immediately; food requirements are based on surviving family members, rounded to clutches as in the existing provisions system.

`tests/young.spec.ts` exercises maturation, mixed ages, gathering, rescue grace, death, return, obstacle avoidance, keyboard/button access, pause and persisted losses. Browser captures are written to `artifacts/family-following.png` and `artifacts/family-mobile.png`.

# PRD: Neon Bomb Brick Playable

## 1. Problem Statement

The operator wants a standalone mobile-portrait HTML5 playable ad experience built with Phaser. There is no existing Phaser game shell in the repo, so this feature is scoped as a fresh standalone playable rather than an extension of an existing game.

The playable needs to communicate the core appeal quickly: the player drops numbered bombs into rising numbered brick rows, watches values resolve through collisions, and tries to survive before the bricks reach the top. The experience should be immediately understandable, visually polished in a neon style, and tuned for a short ad-like session.

Affected users are first-time mobile players interacting with the playable in a browser. The current repo does not provide the requested gameplay, visual system, scoring, or end-screen CTA flow.

## 2. Goals

- Goal 1: Deliver a standalone Phaser-based HTML5 playable that runs in mobile portrait orientation in a browser.
- Goal 2: Provide the complete core gameplay loop: numbered bricks rise from the bottom, the player taps to drop numbered bombs from the top, and collision outcomes follow the requested number comparison rules.
- Goal 3: Tune the first-time player experience so a typical session reaches game over in approximately 30-45 seconds.
- Goal 4: Increase difficulty over time by generating brick numbers that trend higher on average as the session continues.
- Goal 5: Display score based on the numeric value cleared from bricks, with no high-score persistence requirement.
- Goal 6: Use neon-style art direction for background, bomb, bricks, explosions, particles, danger line, and game-over UI.
- Goal 7: Make brick and bomb tint communicate numeric strength, with lower values appearing greener and higher values appearing redder.
- Goal 8: Include game feel effects: pulsing top danger line, explosion particles, brick spawn fade-in, screen shake on exact-match row clears, and game-over fade-in.
- Goal 9: Provide a game-over screen with a fake `Play` CTA that restarts the playable.

## 3. Non-Goals / Explicit Exclusions

- This version will not integrate with a specific playable-ad network SDK.
- This version will not implement store redirects, external clickthrough behavior, analytics callbacks, or install tracking.
- This version will not store high scores or player history.
- This version will not include user accounts, menus, level selection, or progression systems.
- This version will not expose player choice over bomb values; each bomb value uses random scaling.
- This version will not require custom asset files supplied by the operator; the game should include its own neon-style visual treatment.

## 4. Assumptions

- The playable is optimized for mobile portrait first, with desktop browser support useful only for testing.
- The bomb drops from the top at the tapped horizontal position unless later product review identifies a better control feel.
- Only one active bomb should be dropped per cooldown interval.
- Brick rows spawn at the bottom and are pushed upward over time.
- Brick values are randomly generated from 1 to 30, with the random distribution shifting upward as elapsed time increases.
- Bomb values are also randomly generated from a scaling range that increases as the session progresses.
- Exact number matches between bomb and brick destroy both the bomb and the hit brick, then destroy all bricks on that same row.
- When the bomb value is greater than the brick value, the brick is destroyed, the bomb continues falling, and the bomb value is reduced by the brick value.
- When the bomb value is lower than the brick value, the bomb explodes, and the brick value is reduced by the bomb value.
- Score increases by the total brick value removed or cleared, including values removed through partial damage and row clears.
- The fake `Play` CTA on the game-over screen restarts the playable.

## 5. Constraints

- Tech stack constraints: Must use Phaser for the playable game.
- Form-factor constraints: Must be designed for mobile portrait play.
- Session constraints: Gameplay should escalate quickly enough that a typical first-time player loses within approximately 30-45 seconds.
- Interaction constraints: Primary interaction is tapping the screen to drop a bomb, gated by a small cooldown.
- Visual constraints: Neon style is required, and brick/bomb color must map from green for lower numbers to red for higher numbers.
- Infrastructure constraints: Must run as a standalone web playable in a browser; no ad-network packaging is required for this version.
- Backwards compatibility constraints: None identified because there is no existing game shell or persisted player data to preserve.

## 6. Definition of Done

Feature is considered complete when:

- [ ] Architecture document approved
- [ ] All implementation phases completed
- [ ] All review findings resolved
- [ ] Documentation written
- [ ] Tests passing
- [ ] No open blockers
- [ ] Playable runs in a browser in mobile portrait dimensions
- [ ] Core bomb-versus-brick collision rules behave as specified
- [ ] Bricks rise toward the top and trigger game over when they reach the top boundary
- [ ] Tap cooldown prevents continuous bomb dropping
- [ ] Brick and bomb values scale upward over time
- [ ] Score reflects brick value removed or cleared
- [ ] Game-over screen fades in and the fake `Play` CTA restarts the playable
- [ ] Required neon visual effects are present and visible during gameplay

## 7. Open Questions

- What exact mobile portrait reference resolution should implementation target first?
- Should score award the full original value of a row-cleared brick or only its remaining value at the time of clearing?
- Should partial brick damage visually update tint immediately based on the reduced value?
- Should the bomb drop strictly at tap position, from a fixed launcher position, or with any aim/preview affordance?
- What cooldown duration should be considered acceptable for the first tuning pass?
- Are there file-size constraints for the standalone playable, even without ad-network packaging?
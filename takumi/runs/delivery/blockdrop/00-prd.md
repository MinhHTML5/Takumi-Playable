# PRD: Number Bomb Brick Breaker Playable Prototype

## 1. Problem Statement

The operator wants a small, self-contained Phaser playable prototype that demonstrates a fast, mobile-portrait arcade loop suitable for playable-ad style evaluation without ad-network packaging requirements.

Players need an immediately understandable tap-based interaction: numbered bricks rise from the bottom of the screen, and the player drops numbered bombs from the top to destroy or weaken bricks based on number comparison rules. The prototype should communicate pressure, reward successful clears with visual feedback, and end quickly enough to expose replay and CTA behavior.

Affected users:
- Primary: players testing the mobile portrait playable prototype.
- Secondary: the operator and review team evaluating whether the mechanic is fun, readable, and ad-like.

What is currently missing:
- No playable implementation of the described numbered bomb vs. rising numbered bricks loop.
- No neon visual treatment, number-based tinting, or juicy feedback for this mechanic.
- No prototype endscreen with replay and stub CTA actions.

## 2. Goals

- Goal 1: Deliver a self-contained Phaser playable prototype that runs in a browser and is designed primarily for mobile portrait tap play.
- Goal 2: Implement the core numbered collision rules: bomb greater than brick destroys the brick and subtracts the brick value from the bomb; bomb lower than brick explodes and subtracts bomb value from the brick; equal values destroy both and clear the entire row.
- Goal 3: Create a short-session difficulty curve where an average player is expected to lose after roughly 30-45 seconds.
- Goal 4: Show current score and best score so players have a lightweight replay motivation.
- Goal 5: Use neon-styled visuals for the background, bomb, bricks, explosions, particles, danger line, and game-over UI.
- Goal 6: Tint bricks and bombs by number, with lower values trending green and higher values trending red.
- Goal 7: Include clear juice and feedback: pulsing top danger line, explosion particles, brick spawn fade-in, screen shake on full-row clears, and game-over fade-in.
- Goal 8: Present a game-over state with both replay and stub call-to-action buttons visible in mobile portrait.

## 3. Non-Goals / Explicit Exclusions

- No upgrades or player progression systems.
- No shop.
- No tutorial screens.
- No level map.
- No monetization plumbing.
- No real CTA integration; the CTA button may be present but does not need to perform an external action.
- No ad-network packaging, SDK integration, or strict playable-ad bundle compliance for this version.
- No desktop-first optimization; desktop browser playability is acceptable only insofar as it does not compromise the mobile portrait experience.

## 4. Assumptions

- The playable prototype can be created as a new Phaser game because no existing game systems or documentation were identified in the repo context.
- Mobile portrait is the primary target surface.
- Tap input is the primary control method.
- Best score only needs to support replay motivation within the prototype context; persistent cross-session storage is not required unless later requested.
- The operator values readability of the numbered objects and collision outcomes over simulation realism.
- The CTA button is a visual and interaction stub only.

## 5. Constraints

- Tech stack constraints: Use Phaser for the playable prototype.
- Performance constraints: The game should remain smooth on common mobile browser viewports during particles, explosions, rising bricks, and screen shake.
- Infrastructure constraints: The prototype should be self-contained and browser-playable, without backend services.
- Backwards compatibility constraints: None identified.
- Experience constraints: The core loop should be understandable without tutorial screens, relying on intuitive visual feedback and rapid iteration.
- Pacing constraints: Difficulty should escalate quickly enough that typical sessions end in roughly 30-45 seconds.

## 6. Definition of Done

Feature is considered complete when:

- [ ] Architecture document approved
- [ ] All implementation phases completed
- [ ] All review findings resolved
- [ ] Documentation written
- [ ] Tests passing
- [ ] No open blockers
- [ ] Prototype runs in a browser in mobile portrait dimensions
- [ ] Bomb and brick number comparison rules behave as specified
- [ ] Bricks spawn from the bottom and rise toward the top loss condition
- [ ] Player can tap to drop bombs subject to a short cooldown
- [ ] Brick number generation trends upward on average as the game continues
- [ ] Score and best score are visible and update correctly
- [ ] Game over appears when bricks reach the top
- [ ] Game-over UI includes replay and stub CTA buttons
- [ ] Neon visual treatment and requested juice effects are present

## 7. Open Questions

- What exact scoring formula should be used for destroyed bricks, damaged bricks, and full-row clears?
- Should best score persist after a browser refresh, or only during the active page session?
- Should bomb numbers be randomly generated, scale with time, or follow a visible queue/range?
- How many brick columns and rows should the mobile portrait board use?
- Should same-number row clear trigger only when the bomb value equals the first brick it hits, or any brick it collides with after previous subtractions?
- Should the CTA stub visually simulate a store/download action, or remain a generic button?
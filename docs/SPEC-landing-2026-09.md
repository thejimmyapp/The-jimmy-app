# SPEC — Landing rebuild ("LAND"), September 2026

Owner: Ryan. Gate: Gate #4. Source: owner scratch notes, 2026-09-05. Every line
marked **DEFAULT** is a gate choice the owner can overrule with one word; every
line marked **OWNER** is his and stays open until he rules.

## 1. The flow, end to end

```
[Landing]  brand · top-right: [Log in] (disabled) [Sign up] (greyed)
           carousel: slide 1 … slide N   (explains: publish 3 learning moments → you may register)
           last slide: massive [Start]
    │ Start
    ▼
[Quest]    top bar: 5:00 countdown (starts NOW) · checklist 0/3 "learning moments published"
           left rail + right dock: inert (unchanged locked chrome, R5)
           stage: Choose a game to review (existing GuestMatchupList)
    │ pick game → save 3 moments (existing wizard, existing 3-for-5 completion)
    ▼
[Complete] checklist 3/3 · countdown stops · [Sign up] un-greys → existing claim form
           [Log in] stays disabled until the credential-intake ruling
```

Scrapped: the "Click me? / Sign in" entry card, Word Vertigo, and the timer
starting on page render.

## 2. Acceptance criteria (what the gate checks on production)

| # | Criterion | How the gate checks |
|---|---|---|
| A1 | Fresh guest lands on the carousel; no "Click me?", no Word Vertigo input in the DOM | DOM query for the old `guest-entry-node` / `#onboarding-username` → absent |
| A2 | Top-right shows **Log in** (disabled, tooltip/aria "Coming soon") and **Sign up** (disabled while `completed=false`) | `button[aria-label="Log in"].disabled === true`; `Sign up` disabled |
| A3 | Carousel is keyboard- and mouse-operable; last slide shows **Start** | click through; `Start` visible only on the last slide |
| A4 | `questDeadline` is `null` until Start is clicked; Start sets it to now + 5 min and routes to the matchup list | read `localStorage` before/after; listbox "Guest matchups" appears |
| A5 | During the quest a top bar shows the countdown and `n/3` from the server's `saved_moment_count` | save a moment → bar reads `1/3` without reload tricks |
| A6 | After the third save: bar reads `3/3`, countdown stops, Sign up enabled and opens the claim form | `POST /api/guests` → `completed=true`; claim form reachable by mouse |
| A7 | Timer expiry still resets the guest (R58) and returns to the landing carousel; the carousel does NOT restart the timer, so an idle tab fires at most one /api/guests/reset per expiry and none while idle | let a fresh guest expire; wait 6 min on the carousel; guest_number unchanged, no further POST /api/guests/reset |
| A8 | Rail + dock stay inert on landing and during the quest exactly as today | `[inert]` on `.app-rail-locked-content` and `.app-dock` |
| A9 | Golden build green; every deleted/edited test listed in the executor's report and diffed by the gate | CI + gate's own clone |

## 3. Defaults and open owner calls

| Topic | DEFAULT (gate) | OWNER call? |
|---|---|---|
| Timer start | On **Start** click, not on page render | — |
| Timer expiry | Unchanged (R58: wipe + new guest number), lands back on the carousel | — |
| Carousel content | 4 slides, copy shipped as visibly labelled `[COPY-PLACEHOLDER]`; owner copy replaces it verbatim later (R: owner copy ships verbatim) | **OWNER**: final copy |
| "AI carousel" | Read as: a carousel with placeholder imagery; no in-app generation | **OWNER**: if you meant AI-generated slide art, that is an asset task for Lane 1 |
| Log in | Disabled, "Coming soon"; enabled only after the credential-intake ruling | **OWNER**: credential intake (held P0) |
| Sign up | Disabled until `completed`; then opens the existing email claim form (`POST /api/accounts/claim`) | — |
| Checklist source | Server `saved_moment_count` from `/api/guests` (authoritative), not localStorage | — |
| Mission page, notes board, /blocks link | Unchanged (blocks link already removed by UILIB-01) | — |
| Mobile / < 992 px | Unchanged: the existing "widen the window" gate | — |

## 4. Chunks (one executor, one branch, one deliverable each; serial merges by Lane 2)

| Chunk | Lane | Scope | Done when |
|---|---|---|---|
| LAND-00 | 1 | This spec into `docs/`, docket benchmark **A7 — Landing rebuild**, rulings logged | merged |
| LAND-01 | 3 | Recon only: file/line map of everything the flow replaces (`OnboardingMap`, `App.tsx` phase machine + `questDeadline` start at App.tsx ≈310, `quest.ts`, `guestChrome.ts`, `AppShell` lock flags) and the test blast radius | report accepted |
| LAND-02 | 3 | `LandingPage` (top bar + carousel + Start) replaces the entry phase; Start sets the deadline and enters matchups; old entry unmounted, not yet deleted | A1–A4 on prod |
| LAND-03 | 3 | Quest top bar: countdown + `n/3` checklist; completion state; Sign up wiring to the claim form | A5, A6 on prod |
| LAND-04 | 3 | Delete `OnboardingMap`, Word Vertigo, their tests and CSS; `docs/DEV-RUN.md` entry paragraph updated | A7, A8, A9 |
| LAND-05 | 4 | Credential-intake options memo (magic link · password · Chess.com OAuth via existing `CHESSCOM_OAUTH_CALLBACK_URL`) with privacy-policy implications, one page, no code | owner rules |
| LAND-06 | 4 | Log in, per the ruling | after LAND-05 ruling |

Rules that bind every chunk: fresh clone only; push on commit; no test is
adjusted to pass — deleted tests are listed and justified; owner copy verbatim,
placeholders labelled; locked chrome stays inert, never removed (R5); no sync DB
calls in async routes; fail closed.

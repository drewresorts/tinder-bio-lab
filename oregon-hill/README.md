# OREGON HILL

*A PS1-style survival horror RPG for the freelance creative.*

> In my restless dreams, I see that neighborhood. Oregon Hill.

You're a freelance creative in your mid-twenties, living in Oregon Hill, Richmond, VA. You have a laptop, a 1998 Subaru with one hubcap, a roommate named Sage, and 14 days to survive. Pay the rent. Stay relevant. Stay sane. Mind the meter.

Welcome home. You are now a member of the Oregon Hill gentrification community.

## Play it

It's a static web game (Three.js loaded from a CDN, no build step). ES modules need to be served over HTTP, so from this folder run:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Works on desktop (keyboard + mouse) and on phones (on-screen stick and buttons).

| Input | Action |
| --- | --- |
| WASD / left stick | Walk (camera-relative) |
| Shift / RUN | Run (burns energy) |
| Mouse drag / ← → / right-side swipe | Turn the camera |
| E | Interact / talk |
| Space / F / ⚔ | Swing your U-lock |
| C / 🔦 | Flashlight |
| Tab / P / ☎ | Phone: status, gigs, tickets, ink, memos, map, save |
| 1-4, Enter | Dialogue choices |

## Survive

- **Rent** is due on Days 7 and 14. Pay Dale from Hilltop Property Solutions LLC in person, or use the Tenant Portal (plus a $12.50 "convenience fee"). Miss it and you get a 5-day pay-or-quit notice. Miss that and you live in the Subaru.
- **Gigs**: take absurd jobs from the Grind Theory gig board, or from people you meet at shows. Work them at your desk in 2-hour sessions. Expect revision requests ("can it pop more? like, sonically?"). Invoices pay Net-1 to Net-3, unless the client ghosts you. You can chase invoices from your phone.
- **Parking**: your Zone 1 permit expires on Day 3, and Officer Gary is always watching. Two-hour limits, street sweeping, and flippant tickets ("one hubcap — felt disrespectful") stack up, and late fees grow. Owe more than $300 and you get booted. Move the car, renew the permit (if the city portal is up), or plead with Gary.
- **Clout**: be active in RVA. Go to trivia, open mics, DIY shows at The Basement, Fridays at Gallery Fivefold, River Day at the Overlook, the Wednesday twilight walk in Hollywood Cemetery, and day trips on the (still free) GRTC bus. Clout decays every night. **Low clout makes the fog close in**, and the gig board dries up.
- **Ink**: three shops, three artists (Moth, Big Sal, Juniper). Small talk before the needle. Pick the right lines and the price drops. Ask "does it hurt?" and it goes up. Tip, or they'll remember. Sage also offers free stick-and-pokes. They've been practicing on an orange.
- **Friends**: Tanner and Bex at The Lowered Expectations. Your friendship is built on never acknowledging how much you all drink. Another round is always an option. Honesty is not.
- **The Other Hill**: between midnight and 5 AM, or whenever your sanity drops below 25, the sirens sound and Oregon Hill rusts over. Your pocket radio crackles when something is near: parking wraiths, past-due invoices, brunch ghouls. On rent eve, something bigger comes. Stay home, or swing the U-lock.

Sanity hits zero and you move back to Chesterfield. There are seven endings, one of them secret. (Ask around about the iron dog.)

## Under the hood

- `src/ps1.js`: PS1 look. Renders to a 240p target, snaps vertices to the pixel grid (the wobble), maps textures affinely (the warp), uses per-vertex lighting and 15-bit color with 4×4 Bayer dithering, and draws distance fog. It also has a flashlight, street-lamp pools, windows that light up at night, and the Other Hill rust shader. All textures are tiny procedural canvases.
- `src/world.js`: builds the hill (rowhouses, porches, the Cary St strip, Belvidere, Hollywood Cemetery, the Overlook, the James and the coal train) plus all interiors. Static geometry is merged per material and per spatial cell, and big surfaces are subdivided so vertex snapping can't tear them.
- `src/game.js`: state, clock, stats, every interaction and dialogue tree, phone UI, save/load, endings.
- `src/ai.js`: pedestrians, Officer Gary, the horrors, the train, and ticketing during skipped time.
- `src/content.js`: all the writing. Edit this to add gigs, ticket reasons, memos, or tattoo small-talk.
- `src/audio.js`: everything is synthesized with WebAudio (drone, radio static, sirens, blips). There are no audio files.

The game autosaves to `localStorage` each time you sleep.

*Oregon Hill is satire, written with love for Richmond. Any resemblance to real landlords is, sadly, inevitable.*

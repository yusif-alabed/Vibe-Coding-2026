# Art style — "Golden Hour Storybook"

Beaver Banff should feel like a storybook postcard of the Rockies that you can walk into: a warm evening light over a timber village, a cobbled plaza with a rocky beaver fountain, wildflower meadows, dark spruce forest and huge snowy peaks. The reference is a richly lit 3D illustration, not flat cartoon.

## Pillars

| Pillar | What it means in practice |
|---|---|
| **Golden-hour light** | Low warm sun from the east, real cast shadows (sun shadow map), soft wrapped shading, cool sky fill in the shade, a gentle golden rim on silhouettes. |
| **Atmosphere** | Painted sky with drifting clouds and sun glow; distance haze that warms toward the sun and thins with altitude, so peaks stay crisp and valleys go soft blue. |
| **Modelled detail** | Real 3D cobbles, flagstones, logs, shingles, timber trusses, boulders, grass blades and flowers — no flat ground textures. |
| **Living world** | Grass, flowers and trees sway in the wind; water ripples, reflects the sky and glints; waterfalls stream; chimneys smoke; windows and lanterns glow. |
| **Chibi beavers** | Head ≈ body size, big buck teeth, paddle tail, tiny feet. Cute first, realistic never. Thin ink outline only on characters. |
| **Sticker UI** | Cream cards, 3px ink borders, hard drop shadows, rounded "Fredoka" display font. Buttons squish down when pressed. |

## Where things are built

| What | File |
|---|---|
| Lighting, shadows, sky, haze, water and waterfall shading | `client/src/engine/renderer.ts` |
| Village layout, terrain colours, cobbles, trails, grass and flower placement | `client/src/game/hubWorld.ts` (`applyVillageLight` sets the sun and sky) |
| Lodge, cabins, fountain and statues, benches, lanterns, fences, dock | `client/src/game/village/architecture.ts` |
| Spruces, boulders, grass tufts, lupines, daisies, buttercups, ferns | `client/src/game/village/nature.ts` |
| Snowy mountain range | `client/src/game/village/mountains.ts` |
| Positions of structures that are solid on the server | `shared/src/village.ts` |

Tips: keep the sun low and warm, keep meadow greens slightly yellow where the sun hits, and use lupines and daisies in clusters near paths and rocks rather than as a carpet.

## Palette

All colours live in `client/src/game/palette.ts`. Change them there, not inline.

| Role | Hex |
|---|---|
| Ink (outlines, text) | `#2e1c12` |
| Glacier water | `#2ec4c6` / deep `#1a9aa6` |
| Pine | `#2f7d55` / dark `#23634a` / light `#3f9a63` |
| Meadow | `#86c25a`, `#74b04c`, `#9bd068` |
| Timber | `#b27445` / dark `#8a5532` / light `#cf9260` |
| Snow | `#f7fbff` / shade `#dbe8f5` |
| Roofs | green `#4c7a64`, red `#d9483b`, teal `#1fa9a1` |
| Window glow | `#ffd67a` |
| Coins / gold | `#f5c242` |
| UI teal / orange | `#1fb5ad` / `#ff8a3d` |

## The beaver

Built in code in `client/src/game/beaver.ts` from parts (body, head, arms, feet, tail) so it can waddle, swim, wave, cheer, hop and ride a toboggan.

- Big round head (about the size of the body), pear-shaped body, cream belly and chest tuft.
- Fur colour is player-chosen (6 natural browns). Muzzle, belly and inner ears mix the fur with cream.
- Two chunky buck teeth and a shiny nose are the signature — always visible from the front.
- Puffy cheek lobes with whisker freckles, round ears, a fur tuft on top.
- Paws with tiny claws, big webbed feet, a scaly cross-hatched paddle tail.
- Cosmetics attach to the head (hats, sized to the big head) or body (scarves, packs).

### Faces and expressions

The face is built from swappable pieces (dark oval eyes with one small highlight, subtle brows, mouth) so one model can show many moods. Aim for friendly but not sugary: no eye whites (small pupils in big whites read as staring), but also no giant sparkly eyes or rosy blush.

| Expression | Eyes | Brows | Mouth | When it shows |
|---|---|---|---|---|
| Neutral | Open, blinking | Low, relaxed | Small curve | Default |
| Happy | Closed "^ ^" | Lifted | Small curve | 👋 ❤️ 🦫 emotes, swimming, waving |
| Excited | Closed "^ ^" | Lifted | Open, tongue | 🎉 ⛄ emotes, speed boost |
| Surprised | Bigger | High | Small "o" | 😮 emote |
| Dizzy | Spinning "X" | Worried | Half open | Hitting an obstacle (+ circling stars) |
| Determined | Narrowed | Angled down | Smile | Race countdown |

Beavers also blink (each on their own rhythm), move their mouth while their chat bubble is up, and squash-and-stretch when they hop.

**Outlines:** only outer shapes get the ink outline (head, body, ears, hat). Small face details (nose, muzzle, teeth, dots) live in the separate `muzzle` part and are drawn without outlines, otherwise each one gets its own dark ring.

**Character sheet:** open the game with `?characters` at the end of the address (for example `http://localhost:5173/?characters`) to see every expression side by side, or `?characters=close` for a close-up of the face. Use it when changing the beaver.

## Do / don't

- ✅ Use primitives and the palette. If something looks plain, add a second colour band, not more polygons.
- ✅ Keep silhouettes readable at 30 m: big hats, chunky props.
- ❌ No photo textures, gradients-as-detail, or realistic proportions.
- ❌ No Club Penguin (or any other game's) characters, logos, names, music or art. Everything here is original.

## Why no textures?

Everything is vertex-coloured geometry, so the whole game is a few hundred KB and loads instantly. If you add textures later, keep them flat-colour and hand-painted so they match.

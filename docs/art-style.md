# Art style — "Chunky Alpine Toon"

Beaver Banff should feel like a hand-painted postcard from the Rockies that you can walk into: cartoony, cozy and bold, readable on a phone screen.

## Pillars

| Pillar | What it means in practice |
|---|---|
| **Chunky low-poly** | Few, big faces. Flat shading (one colour per face). Shapes built from simple primitives: spheres, cones, boxes, cylinders. |
| **Ink outlines** | Characters and props get a thick dark-brown outline (`#2e1c12`), like a cartoon. Terrain and water don't, so the world stays soft. |
| **Toon light** | 3 light bands (lit / mid / shade) instead of smooth gradients, plus a warm rim light and a sky-blue fill from above. |
| **Postcard palette** | Glacier turquoise, pine green, warm timber, snow white, peach-to-blue sky. Saturated but never neon (except arcade signage). |
| **Chibi beavers** | Head ≈ body size, big buck teeth, paddle tail, tiny feet. Cute first, realistic never. |
| **Sticker UI** | Cream cards, 3px ink borders, hard drop shadows, rounded "Fredoka" display font. Buttons squish down when pressed. |

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

**Character sheet:** open the game with `?characters` at the end of the address (for example `http://localhost:5173/?characters`) to see every expression side by side. Use it when changing the beaver.

## Do / don't

- ✅ Use primitives and the palette. If something looks plain, add a second colour band, not more polygons.
- ✅ Keep silhouettes readable at 30 m: big hats, chunky props.
- ❌ No photo textures, gradients-as-detail, or realistic proportions.
- ❌ No Club Penguin (or any other game's) characters, logos, names, music or art. Everything here is original.

## Why no textures?

Everything is vertex-coloured geometry, so the whole game is a few hundred KB and loads instantly. If you add textures later, keep them flat-colour and hand-painted so they match.

# Groma

Your code is a big city.
It has too many streets to see at once.
Groma draws you the map.
And the map remembers what every part is FOR — not just its name.

(A "repo" is a folder full of code. Groma lives right inside yours.)
(A groma was a tool from long, long ago for measuring fields. A good name for a map-maker.)

## The three magic spells

This is the promise. Three little spells:

```text
groma init
groma scan
groma
```

- `groma init` — "Groma, wake up here and make your folder."
- `groma scan` — "Groma, go take one careful look at the code."
- `groma` — "Groma, show me the map."

**Honesty time.** Not everything works yet.
The first spell works today.
The second spell — the careful look — is still being built.
The third spell today only lists the spells Groma knows.
The map picture is still being built too.
The next two lists say exactly what is real.

## Today you can

- Say `groma init` in any project. Groma makes its folder there.
- Put parts on the map yourself, one by one.
  (This takes some grown-up typing. A robot friend can do it too.)
- Draw lines between parts: this one _needs_ that one.
- Ask Groma: "What are the biggest parts?" Then point at one and ask: "What is inside this?"
- Search the map for a word.
- Say just `groma` and Groma politely lists every spell it knows.
- Open Groma's folder and look. It is all just words you can read.

## Very soon you can

Here is the dream, almost ready.
Pick a giant project. Ours next door is called `codex`.

```text
cd ../codex
groma init
groma scan
groma
```

(`cd ../codex` just means "walk into the codex folder".)

When the builders finish — this is what they are making next — you will see:

- The helper robot takes one careful look at the code.
- Groma puts what it found on the map — and it never erases what you wrote.
- The robot finds the parts. You — or your robot friend — still tell the map
  what each part is FOR.
- A map you can click opens. The big outside boxes first.
- Click a box to peek inside. Zoom for more.
- The map is never too big. Never the whole city at once.

Until then, `groma scan` gets turned away — Groma says it does not know that spell yet.
And `groma` all by itself only lists its spells. The map comes soon.
We will not pretend.

## Promises Groma keeps

- Groma reads your code to draw the map. It never runs your app.
  Some helpers are little programs from someone else's project.
  Groma runs one of those only after you say, out loud: "I trust this one."
- Groma only draws the map. It never builds the city or fixes the city.
  Other tools do that.
- When Groma is not sure, it stops and asks. It never guesses.
- What you wrote is safe.
  If the robot's look misses something, what you wrote stays.
  The robot can never rub out your words.

## Little dictionary

Grown-ups use big words for map things. Here is what they really mean.

| Big word     | Kid words                                                                            |
| ------------ | ------------------------------------------------------------------------------------ |
| blueprint    | the map                                                                              |
| component    | a part — one box on the map                                                          |
| relationship | a line between boxes, like "this one needs that one" or "this one talks to that one" |
| scan         | one careful look at the code (it only counts if it finishes)                         |
| intent       | what we want a part to do                                                            |
| evidence     | what the robot really saw — the clues                                                |
| scanner      | the helper robot that looks at code (it never peeks at our map)                      |

## For grown-ups and robots

The kid version above is true. Here is the rest.

- The deep docs:
  [MANIFESTO.md](MANIFESTO.md) says why Groma exists and what it refuses to be.
  [ARCHITECTURE.md](ARCHITECTURE.md) says how it is built.
  [DEVELOPMENT.md](DEVELOPMENT.md) says how to work on it.
- AI agents use the exact same commands as people.
  Same map, same meaning, no secret doors.
- Everything lives as readable files inside your own repo.
  No cloud. No account. From the very start, Groma sends nothing anywhere.

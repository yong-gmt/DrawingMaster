# Drawing Master — working notes for Claude Code

A single-file web CAD app that imports DXF drawings, restyles their annotation to
ANSI/ISO conventions, and exports DXF that other CAD programs can edit.

## How the build works

The app ships as **one HTML file**. It is produced by applying `scripts/build.py`
to `src/base.html`:

```bash
python3 scripts/build.py            # -> drawing-master/DrawingMaster.html
python3 scripts/artwork.py          # then embeds the title-block artwork
```

`build.py` is a list of exact string replacements (`rep(old, new)`), plus module
files from `src/modules/` that get spliced in. Every `rep` **asserts** that its
target appears exactly once, so a build either applies cleanly or fails loudly —
it never half-applies.

**This is not a good long-term shape.** It grew from patching a file that could
not be split at the time. See `docs/ROADMAP.md` for the plan to break `base.html`
into real modules. Until then:

- Never edit `drawing-master/DrawingMaster.html` directly — it is the build
  output and is overwritten. It is the file to OPEN, not the file to edit.
- Edit `src/modules/*.js` for module code, or add a `rep()` in `scripts/build.py`
  for changes inside `base.html`.
- After every change, run the build and then the tests.

## Two layers, two kinds of test

`src/lib/*.mjs` are **components**: real ES modules that import nothing, export
their functions, touch no DOM and no globals. They are unit-tested in Node in
milliseconds.

`src/modules/*.js` still run inside the app's single global scope and need a real
browser to test. Most of the code is still here — see `docs/COMPONENTS.md` for
what to pull out next and in what order.

```bash
bash scripts/unit.sh                 # components, milliseconds
bash scripts/test.sh                 # the whole app through a browser
node tools/deps.js                   # how tangled each module still is
```

Browser tests measure what gets *drawn*, not what the data structures say — that
distinction is the reason most of the bugs in this project were found at all.

```bash
npm install                          # playwright, sharp
npx playwright install chromium
node tests/t_model.js                # one browser test
bash scripts/test.sh                 # the whole suite (discovers tests/t_*.js)
bash scripts/test.sh sec             # only names containing "sec"
bash scripts/test.sh -q              # failures only
```

Every test prints a line of measurements and exits 0. Read the numbers; a test
that prints nothing has failed.

## Rules that matter here

**1. Measure what is drawn, not what the model says.**
Most of the wasted effort in this project came from tests that asked the model
whether it was correct. The model always agreed with itself. Check primitives,
pixels, or the exported file.

**2. Test the returning user, not just the new one.**
Two of the worst bugs only appeared for someone who already had saved work: a
project saved by an older build, and a browser whose storage was full. A test
that opens a fresh browser every time will never see either.

**3. Import shows the file. STYLIZE changes it.**
Anything the program invents must appear only after the user asks for it.

**4. Never delete the drawing.**
Annotation may be rewritten. Object geometry, the frame and the title block are
read-only. `tests/t_objdmg.js` enforces this and must stay at zero.

**5. When something looks wrong, get a picture before theorising.**
Screenshot the region. Several rounds were lost to reasoning about geometry that
a single image would have settled in a minute.

## Where things are

| | |
|---|---|
| `src/base.html` | the original app: UI, canvas, DXF reader, title block |
| `src/lib/hatch-pattern.mjs` | the first real component — pure, unit-tested |
| `src/modules/dimmodel.js` | the dimension model — geometry from measured points |
| `src/modules/dimgrips.js` | selection, grips, dragging |
| `src/modules/section.js` | section markers, found by shape not by layer name |
| `src/modules/recover.js` | rebuilding dimensions from loose geometry |
| `src/modules/stylize.js` | the STYLIZE loop |
| `src/modules/balloon.js` | item balloons |
| `src/modules/dxfexport.js` | the DXF writer |
| `src/modules/idb.js` | project storage (IndexedDB) |
| `src/modules/migrate.js` | bringing older saved projects up to date |
| `docs/SYNC.md` | sharing projects across machines |
| `docs/CURRENT-STATE.md` | what the app does today and how STYLIZE works - read this first |
| `docs/STYLIZE-RULES.md` | what STYLIZE does, as rules, with the tests that hold each one |
| `docs/ANALYSIS.md` | every root cause found, and how it was found |
| `docs/COMPONENTS.md` | what is and is not a component yet, and the order to fix that |

## What is not finished

`docs/ROADMAP.md`. The short version: angular dimensions have no model, splines
and ellipses leave as polylines, and `base.html` still needs splitting.

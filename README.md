# Drawing Master

**Drawing Master** aligns drawings from different CAD programs (Fusion 360, Inventor) into one consistent format — drawing style, BOM table, and title block all following GMT's standard. Sheet layout stays fully flexible.

Workflow : Import DXF → press STYLIZE → adjust as needed → Export PDF, ready to send to the factory.

No install, no server — a single HTML file that opens instantly.

## Features

| Feature | Description |
|---|---|
| **STYLIZE** | Fixes dimension and section lines into a horizontal landing (ANSI) style |
| **Add Label** | Adds labels to identify the different views on a drawing |
| **Add Balloon** | Adds numbered pointer balloons to call out parts |
| **Add BOM** | Adds a Bill of Materials, with selectable fields to display |
| **Title Block** | A GMT-specific title block, with editable part details on every sheet |

---

## Getting set up

```bash
git init && git add -A && git commit -m "Drawing Master"

npm install
npx playwright install chromium
pip install ezdxf --break-system-packages     # used by the export tests
```

Build and open:

```bash
python3 scripts/build.py       # assemble the single file
python3 scripts/artwork.py     # then embed the title-block artwork
open drawing-master/DrawingMaster.html   # or xdg-open / start
```

Run the tests:

```bash
bash scripts/unit.sh      # components in src/lib — milliseconds
bash scripts/test.sh      # the whole app through a real browser — minutes
```

---

## Layout

```
src/base.html          the app before patching
src/lib/*.mjs          real components: pure, exported, unit-tested
src/modules/*.js       code that still lives in the app's global scope
scripts/build.py       assembles them into drawing-master/DrawingMaster.html
tests/                 Playwright tests, one file per behaviour
fixtures/drawings/     real DXF files from two different CAD programs
fixtures/synthetic/    files generated to test one thing each
docs/                  design rules, analysis, roadmap
```

## Documentation

| | |
|---|---|
| `docs/SYNC.md` | sharing projects across machines - the options, honestly compared |
| `docs/CURRENT-STATE.md` | **what the app does today, and how STYLIZE works — start here** |
| `docs/ANALYSIS.md` | every root cause found in this project, and how |
| `docs/STYLIZE-RULES.md` | what STYLIZE does, as rules, each tied to its test |
| `docs/ARCHITECTURE.md` | why it is built this way |
| `docs/COMPONENTS.md` | what is a component yet, and the order to extract the rest |
| `docs/TESTING.md` | how to write a test that would actually catch something |
| `docs/ROADMAP.md` | what is unfinished, honestly |

# Drawing Master

A single-file web CAD tool. It reads a DXF drawing, restyles the annotation to
drawing-office conventions, and writes DXF that another CAD program can open and
edit — real `DIMENSION` entities, real layers, real line types.

No server, no build step for the user: the output is one HTML file you open in a
browser.

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
open build/DrawingMaster.html  # or xdg-open / start
```

Run the tests:

```bash
bash scripts/unit.sh      # components in src/lib — milliseconds
bash scripts/test.sh      # the whole app through a real browser — minutes
```

---

## Using it with Claude Code

```bash
cd drawing-master
claude
```

`CLAUDE.md` is read automatically and tells Claude how the build works, how to run
the tests, and which rules this codebase holds itself to.

Some openings that suit this project:

```
อ่าน docs/ANALYSIS.md แล้วสรุปว่ายังเหลืออะไรที่ยังไม่ได้แก้
ทำ angular dimension ให้มีโมเดล แล้วเขียนเทสต์ที่วัดจากเส้นที่วาดจริง
รัน bash scripts/test.sh แล้วบอกว่าตัวไหนไม่ผ่านและทำไม
```

Two habits worth keeping when working with Claude here:

- **Ask for the measurement, not the verdict.** "รันเทสต์แล้วบอกตัวเลข" beats
  "แก้ให้หน่อย" — this codebase has a long history of changes that passed every
  check and still looked wrong on screen.
- **One change per round.** A round that mixes six changes cannot be rolled back
  when one of them breaks something.

## Using it with VS Code

```bash
code drawing-master
```

Suggested extensions: **Claude Code**, **Live Server** (open
`build/DrawingMaster.html` with a right-click → *Open with Live Server*, which
avoids `file://` storage restrictions), **Python**, **Playwright Test**.

`.vscode/tasks.json` ships with **Build** and **Test** tasks — `Ctrl/Cmd+Shift+B`
builds.

---

## Layout

```
src/base.html          the app before patching
src/lib/*.mjs          real components: pure, exported, unit-tested
src/modules/*.js       code that still lives in the app's global scope
scripts/build.py       assembles them into build/DrawingMaster.html
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

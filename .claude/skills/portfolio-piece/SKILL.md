---
name: portfolio-piece
description: >-
  Use when adding a new project to William Catt's data-science portfolio
  (~/Documents/Projects/Portfolio, live at williamcatt.dev) or producing
  portfolio-style writeups/figures/demos in the same house style — the
  Overview/Technical/Results/Code/App tab layout, palette-matched matplotlib
  figures, a zero-cost interactive demo, and honest, evidence-driven copy.
  Trigger on "add this to my portfolio", "make a project page", "portfolio
  writeup", "results/figures/demo in my portfolio style".
---

# Building a portfolio piece (William Catt's portfolio house style)

This skill encodes how the **QuoteGuard** and **Legal Text Anonymiser** pages were built so new
pieces come out with the same vibe: a stakeholder-readable Overview, a data-science-heavy Technical
deep dive, a Results section with real numbers on a golden standard, a Code tab, and an interactive
App — all honest and evidence-driven.

## The repo

- **Portfolio**: `~/Documents/Projects/Portfolio` — static HTML, **no build step**, deploys to
  **williamcatt.dev** via Cloudflare Pages on push to `main`. GitHub: `github.com/WillCatt/Portfolio`.
- **The project itself** lives in its own repo (e.g. `~/Documents/Projects/QuoteGuard`,
  `github.com/WillCatt/<Name>`). Figures + demo data are *generated there* and copied into the
  Portfolio's `assets/<id>/`.
- Read `Portfolio/CLAUDE.md` and copy **`projects/anonymiser.html`** — it is the gold-standard
  template. Don't reinvent; mirror it.

## How a project page works

Each `projects/<id>.html` =
1. a `<script>` defining `window.PROJECT` (metadata),
2. one `<template id="tab-*">` per tab (the content — **only edit these**),
3. `<script src="../project-page.js" defer>` — the shared loader that renders the header + tabs.

```html
<script>
  window.PROJECT = {
    id: "<id>", index: "02", title: "<Title>",
    subtitle: "<one line>", color: "oklch(52% 0.14 200)", // per-project hue
    status: "live",            // live | wip | archived | planned
    tags: ["RAG","Guardrails"], repo: "github.com/WillCatt/<Name>",
    demo: true,                // false hides the App tab
  };
</script>
```

**Tabs are template-driven**: the loader renders a tab for whichever `tab-*` templates exist, in the
canonical order in `project-page.js`: `overview, writeup, technical, results, examples, code, app`
(labels OVERVIEW / WRITE-UP / TECHNICAL / RESULTS / WORKED EXAMPLES / CODE / APP). Most pages use the
dual-path **overview + technical** (not a single writeup).

**Adding a custom tab** (e.g. a less-prominent "RAW RESULTS"): add the key to `TAB_LABELS` *and* the
order array in `project-page.js` (append at the end = least prominent). This only affects pages that
have that `tab-*` template. ⚠️ `project-page.js` is **shared** — if it has unrelated uncommitted
edits, stage **only your hunk** with `git add -p` (see Shipping). Otherwise don't touch it.

After creating the page, add a matching entry to the `PROJECTS` array in **both** `index.html`
(featured) and `all-projects.html`. The card link is derived from `id` → `projects/${id}.html`.

## The five tabs — what goes in each (the vibe)

- **OVERVIEW** — *stakeholder, plain language, no jargon, punchy.* Structure: **The problem** →
  **What I built** → 1–2 **findings with a simple chart** → a closing **`<blockquote>` bottom line**.
  Use `<a class="deeper" onclick="document.querySelector('[data-tab=technical]')?.click();...">` to
  link down into deeper tabs. Analogies over equations. Lead with the *tension the project resolves*.
- **TECHNICAL** — *DS deep dive, jargon fine.* Dataset & eval → method bake-off (with charts) → the
  core analysis → pipeline → **Honest negatives** (kept null results — "the null *is* the finding") →
  caveats → **From prototype to production** (what a real deployment would need). This honesty is the
  differentiator.
- **RESULTS** — *real numbers on a held-out / golden standard.* `statrow` stat cards → "How it's
  measured" → a `metrics` table → `figure.fig` charts → **worked runs** (`.run` blocks with real
  verbatim outputs, `io-label` + `anon-out`). Report **bootstrap 95% CIs**, not point estimates.
- **CODE** — repo link, `pre.tree` structure, 1–3 *interesting* snippets (not boilerplate).
- **APP** — interactive demo (see Demos). Always include a short "what's faithful vs lightweight" note.

## Design system (don't break — all are CSS vars in `project.css :root`)

```
--bg #faf8f4   --card #fff   --border rgba(0,0,0,.08)
--text #1a1714  --text-muted #7a6e63  --text-dim #c4b8aa
--accent oklch(52% 0.14 50)   --live oklch(58% 0.16 145)   --wip oklch(62% 0.17 60)
fonts: Space Grotesk (display), JetBrains Mono (mono).  per-project color: oklch(52% 0.14 <hue>)
```
Reuse existing classes (already in `project.css`): `writeup`, `code-tab`, `app-tab`,
`statrow/stat/num/lbl`, `metrics` (+`f1`,`overall`), `defs`, `figure.fig`/`figcaption`,
`run`/`run-mode`/`io-label`/`anon-in`/`anon-out`/`run-note`, `tree`, `deeper`, `role` (`direct`/`quasi`),
`blockquote`, `ladder`, `vault`, `tok`. For interactive widgets, add a **separate** scoped CSS file in
`assets/<id>/` (don't bloat the shared `project.css`).

## Figures (matplotlib, matched to the palette)

Generate in the *project* repo (`figures/build_portfolio_figures.py`), gitignore the outputs, copy
PNGs into `Portfolio/assets/<id>/`. Use this palette config so charts blend into the page:

```python
BG="#faf8f4"; INK="#1a1714"; MUTED="#7a6e63"; GRID="#e6ded2"
AMBER="#b06a16"; GREY="#cdbfae"; GREEN="#3a8f57"; TEAL="#2a8f8f"   # green = safe/live; amber = accent/winner
plt.rcParams.update({"figure.facecolor":BG,"axes.facecolor":BG,"savefig.facecolor":BG,
  "text.color":INK,"axes.labelcolor":INK,"xtick.color":INK,"ytick.color":MUTED,
  "axes.edgecolor":GRID,"axes.grid":True,"grid.color":GRID,"axes.axisbelow":True,"font.size":12})
# hide top/right spines; highlight the winner bar in AMBER, others GREY; before/after = GREY → GREEN
```
Keep them legible and titled (`loc="left"`, `fontweight="bold"`), value labels on bars, `dpi=200`.

## Interactive demos — two patterns, both **zero paid-API**

1. **Free HuggingFace Space iframe** (like the anonymiser). Embed
   `<iframe src="https://<user>-<space>.hf.space" ...>`; add a "lightweight version / cold start"
   note. Good when the real model must run server-side.
2. **Client-side, in-browser** (like QuoteGuard — *preferred when the logic ports*). Re-implement the
   core in JS (BM25, regex guards, extractive logic all port cleanly; cross-encoders/LLMs don't),
   ship the data as static JSON, run entirely in the visitor's browser. **No server, no API, always
   on.** Pattern:
   - Put a container `<div id="qg-demo">` inside the `tab-app` template; load the JS at page level
     (`<script src="../assets/<id>/demo.js" defer>` after `project-page.js`).
   - **Scripts inside a `<template>` don't run when cloned**, so self-init via a `MutationObserver`
     watching for the container, build the index/fetch JSON once, render. Make the file node-safe
     (`if (typeof document !== "undefined")` around DOM bits; `module.exports` the pure functions) so
     you can **unit-test it with node** before wiring the page.
   - **Calibrate any thresholds against real data** (e.g. a BM25 scope floor — measure off-topic vs
     on-topic scores and pick the gap). Don't guess.
   - For a "full raw results" view, precompute the *real* (heavy) system's outputs locally and ship
     the JSON — show real-LLM answers next to gold, with objective badges, **no API at view time**.

## The voice (what makes it land)

- **Honest over flattering.** Surface weak numbers with framing, never hide them — e.g. "retrieval
  finds the gold page 80%, the 8B model cites it exactly 44% — citation precision is the weak spot."
  Honest negatives and a prototype↔production gap section read as rigour, not weakness.
- **Stakeholder Overview, DS Technical.** Same project, two registers.
- **Evidence-driven.** Real numbers on a golden standard, CIs, reproducible scripts named on the page.
- **Show, don't tell.** Worked runs with verbatim output; an interactive demo to play with.

## Process for a new piece

1. In the project repo: build the eval/results, then `figures/build_portfolio_figures.py` (+ any
   demo-data export). Copy outputs → `Portfolio/assets/<id>/`.
2. `cp Portfolio/projects/anonymiser.html Portfolio/projects/<id>.html`; fill `window.PROJECT` + the
   tab templates. Build the demo JS/CSS in `assets/<id>/` if client-side.
3. Add the card to `index.html` **and** `all-projects.html`.
4. **Verify** (below). 5. **Ship** (below).

## Verify (always — catches blank pages)

```bash
cd ~/Documents/Projects/Portfolio && python3 -m http.server 8765 &
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --hide-scrollbars --screenshot=/tmp/p.png \
  --window-size=1280,1400 --virtual-time-budget=6000 \
  "http://127.0.0.1:8765/projects/<id>.html"
```
Then **Read /tmp/p.png** and check: page not blank, tab bar correct, figures load, demo renders. For
a demo/explorer tab the screenshot defaults to the first tab — test it via a tiny throwaway harness
HTML in `projects/` that includes the container + JS directly (delete after). `--virtual-time-budget`
lets async fetch/render finish before the shot.

## Ship

- Commit **only your files** (your `<id>.html`, `assets/<id>/*`, the two card edits). Leave any
  unrelated uncommitted work untouched. If you edited the shared `project-page.js` and it has the
  user's other uncommitted edits, stage just your hunk: `printf 'y\nn\n' | git add -p project-page.js`,
  then confirm with `git diff --cached project-page.js`.
- End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Pushing `main` deploys live** (Cloudflare). It's outward-facing — confirm with the user first
  unless told to push. After pushing, verify live: `curl -sL -o /dev/null -w "%{http_code}"
  https://williamcatt.dev/projects/<id>` and check a key asset is 200.

## Gotchas learned

- The status quo cards may already have the project as a `planned` placeholder (e.g. `rag` → reuse
  its slot). Status `live` only when there's a real page + working demo.
- Don't modify `project.css`/`project-page.js` unless adding a CSS utility or a tab key — they're shared.
- Generated data/figures are gitignored in the project repo; their copies live in the Portfolio repo.
- This user (William) is British-spelling, hands-on, and explicitly prefers honest findings over
  reassurance — write the copy that way.

---
name: page-presentation
description: >-
  Use when writing, restructuring, or reviewing the content of a project page
  in William Catt's portfolio — deciding which tabs a piece needs, what goes
  in each tab (Overview / Technical / Results / Worked Examples / Code / App),
  and how to pitch each tab's register for its audience. Trigger on "write the
  overview", "is this tab right", "review my project page", "which tabs should
  this piece have". Complements `portfolio-piece` (which covers the build
  mechanics, figures, demos and shipping).
---

# Presenting a portfolio page (the tab contract)

The portfolio's job is to get William hired as a junior data scientist. Two readers arrive
at every page and they want different things:

- **The recruiter / hiring manager** (non-technical or skim-mode): wants to know in 60 seconds
  what the project is, whether it worked, and whether this person can communicate. They will
  read **one tab** — the first one — and maybe click a demo.
- **The DS interviewer** (technical, sceptical): wants to know whether the methodology holds up,
  whether the numbers are real, and whether the candidate understands the limits of their own
  work. They go to Technical and Results, and they *will* check whether the claims match.

Every presentation decision follows from one rule: **the first tab must fully serve the first
reader; every later tab may assume more.** Tabs are a *ladder of audience*, not chapters of one
document.

## The canonical tabs, and what each owes the reader

Tab order in `project-page.js` is the prominence order: `overview, writeup, technical, results,
examples, code, app` (+ `raw` last). Default split is **overview + technical + results + code
(+ app)**. Use a single `writeup` only for small pieces that don't justify the split.

### OVERVIEW — elevator pitch, general audience
The only tab most visitors ever read, so it must be self-sufficient: if the visitor closed the
page after this tab, they should still walk away knowing what was built, the headline result,
and why it matters.

- **Structure:** The problem (the *tension*, in plain words) → What I built → 1–2 findings,
  each with one simple chart → a closing `<blockquote>` takeaway.
- **Register:** no jargon, no acronyms without gloss, analogies over equations ("the 6′3″
  Russian who teaches boxing two doors down" explains re-identification better than k-anonymity
  ever will). Numbers allowed, but only ones a lay reader can feel ("two in five", "98%",
  "72% → 100%") — not F1 decimals.
- **Must contain at least one real number and one chart.** An overview with no evidence reads
  as marketing.
- **End every section that has a deeper story with a `class="deeper"` link** into the tab that
  tells it. The overview is the hub; the deeper tabs are spokes.

### TECHNICAL — the deep dive, DS audience
Written for the interviewer who will probe it. Jargon fine; hand-waving not.

- **Structure:** Dataset & evaluation (what's measured, on what, scored how) → method bake-off
  with charts → the core analysis → pipeline/architecture → **What didn't work** → caveats →
  **From prototype to production**.
- **Decisions, not just descriptions.** Every choice gets its evidence: "docling won *because*
  structure beats raw text for grounded retrieval", "BM25 beat TF-IDF *once the test set was
  big enough to trust*". The reversal stories are the best content on the site — keep them.
- **Reporting what didn't work is mandatory**, not optional. Kept nulls ("the ensemble backfired",
  "coreference added +0.0001") are what separates this portfolio from the median one. Frame
  each null with *why* it's informative, then what follow-up it earned.
- **From prototype to production** answers the interview question before it's asked: what would
  a real deployment need that this prototype doesn't have? This section signals seniority.

### RESULTS — the scoreboard, mixed audience
Real numbers on a held-out / golden standard. Skimmable by a recruiter, checkable by an
interviewer.

- **Structure:** `statrow` stat cards (the four numbers that matter) → "How it's measured"
  (define the metric briefly, name the safety-critical one) → definitions table if the
  labels need it → the `metrics` table → key `figure.fig` charts → **worked runs** with
  verbatim input/output.
- **Always state the eval set and that it's held out.** "555 documents the model never saw"
  is the sentence that makes every other number credible.
- **CIs over point estimates** (bootstrap 95% or Wilson). Where N is small, say so next to
  the number, not in a footnote.
- **Annotate the weak rows.** A table with DEM at 45% F1 and no comment looks like an
  oversight; the same table with "the weak spots are where you'd expect: sparse, fuzzy categories — and
  both are handled by Anonymise anyway" looks like judgment.
- Overlap with Technical is fine *when reframed*: Technical shows a chart to justify a
  decision; Results shows the same chart as the scoreboard. Don't duplicate the prose.

### WORKED EXAMPLES (and other extra tabs) — show, don't tell
Extra tabs exist to fill a gap the canonical four can't: verbatim runs (`examples`), a raw
results explorer (`raw`), etc.

- Only add one when it does a job no existing tab does. Three tabs that each half-cover the
  same ground is worse than two that divide it cleanly.
- Worked examples must be **real verbatim output** of the actual system, with `io-label` /
  `anon-in` / `anon-out` blocks and a `run-note` that points out both what worked *and* the
  rough edge ("it clips HR-2021-0847 to HR-[MISC] — the boundary miss the exact-match score
  reflects").
- Name the regeneration command at the bottom (`demo/portfolio_examples.py`) — reproducibility
  is part of the presentation.
- New tab keys go in `TAB_LABELS` *and* the order array in `project-page.js`; append late in
  the order = less prominent.

### CODE — for the engineer who clicks through
Repo link, one-paragraph stack summary, `pre.tree` structure with one-line annotations, then
**1–3 snippets chosen for interestingness**: the contract/interface, the core loop, the one
clever bit. Never boilerplate, never imports. Each snippet gets a heading that says what it
demonstrates.

### APP — proof it's real
The demo converts sceptics: it's the difference between "claims to have built" and "built".

- Lead with one sentence of *what to try* ("paste some legal text, pick a mode…").
- **Always include the faithful-vs-lightweight note**: what the demo shares with the real
  system, what it trades away to run free, and where to see the full model's output instead.
  Without this note a weak demo *undermines* the strong results.
- Include the "demo not loading?" fallback link for iframed/cold-start demos.
- No demo → omit the `tab-app` template (or set `demo: null` / `false`). Never ship a
  "coming soon" tab — an empty promise is worse than no tab.

## Cross-tab navigation (the journey inside a page)

- Overview links *down* (deeper links into technical/results/examples/app); deeper tabs link
  *out* (repo, full write-up). Don't make deeper tabs link back up — the reader who got there
  doesn't need it.
- The blockquote takeaway in Overview should end with the single best next click for a
  convinced reader — usually the App ("Try it yourself →") if there's a demo, else Technical.
- Tabs are deep-linkable (`?tab=results` / `#results`) — use that when sharing a page in an
  application email ("results here: …/quoteguard.html?tab=results").

## Status and card honesty (the journey into a page)

- A card's status must match its page, and `live` means *finished page + real content + (if
  promised) working demo*. Planned projects are non-clickable in the archive — never let a
  visitor reach a stub.
- Card hooks are questions or tensions, not summaries ("Does card counting *actually* beat
  the house?"). Chips carry the one or two numbers that earn the click ("72%→100% safe").
- Keep `index` numbers consistent across `index.html`, `all-projects.html` and the page's own
  `window.PROJECT`.

## Voice (applies to every tab)

- **Candid over flattering.** State the weak number with framing, in the same breath as the
  strong one. "Retrieval finds the gold page 80%, the 8B model cites it exactly 44%" reads as
  rigour; omitting the 44% reads as spin when the interviewer finds it in the repo.
- **Claims sized to evidence.** "Risk reduction, not a legal guarantee"; "read the direction,
  not the third decimal"; report N beside every cut of a small sample.
- **British spelling**, first person, active voice. No filler superlatives ("cutting-edge",
  "state-of-the-art") — let the numbers carry the enthusiasm.
- **One idea per section, one chart per idea.** If a section needs two charts, it's two
  sections.
- **Avoid the AI tells.** Don't lean on em-dashes (vary with `;`, `:`, `()`, full stops); don't
  repeat "honest/honestly" as a verbal tic; skip stock signposts ("Bottom line:", "Net effect:",
  "The headline is…", "in one breath"); avoid the "it isn't X — it's Y" reframe and rule-of-three
  triads as a default cadence. Keep the *principle* (surface weak numbers, report nulls) — just
  not the formula.

## Anti-patterns (each has burned a real page)

- Placeholder text anywhere reachable ("Bullet point one") — worse than no page.
- An Overview that's all problem and no result — the recruiter leaves not knowing if it worked.
- A Results tab that's only a metrics dump — numbers without "how it's measured" and without
  annotation of the weak rows.
- Burying a known weakness for the interviewer to discover — surface it first, framed.
- A demo presented as the product when it's a lightweight stand-in — always label the gap.
- More than ~7 tabs, or two tabs whose names don't tell the reader which one they want.

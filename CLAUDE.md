# Portfolio — Claude Code instructions

This is William Catt's data science portfolio. It's a **static HTML site** — no build step, no framework, no dependencies beyond CDN React/Babel. You can edit, preview locally, and deploy directly.

## File map

```
.
├── index.html              # Landing page (notebook-style hero + 4 featured projects + "view all" link)
├── all-projects.html       # Searchable/filterable archive of every project
├── project.css             # Shared styles for project detail pages
├── project-page.js         # Shared loader: reads window.PROJECT + <template> tags
└── projects/
    ├── kaggle.html         # Project detail page (one per project)
    ├── rag.html
    ├── anonymiser.html
    └── blackjack.html
```

## Your job

The landing page and archive are done. **Your task is to write the real content** for each project detail page. Pages have **Write-up · Code · App** tabs by default; a page can instead split the write-up into **Overview** (stakeholder) + **Technical** (deep dive) — see the anonymiser page and the template-driven tab note below.

## How a project page works

Each `projects/<id>.html` has the same shape:

1. A `<script>` block defining `window.PROJECT` — metadata (title, status, tags, repo URL).
2. `<template>` elements — the HTML content for each tab. **Tabs are template-driven**: the loader renders a tab for whichever of these templates exist, in this canonical order — `tab-overview`, `tab-writeup`, `tab-technical`, `tab-code`, `tab-app` (labels OVERVIEW / WRITE-UP / TECHNICAL / CODE / APP). Most pages use a single `tab-writeup`; the anonymiser page uses the dual-path `tab-overview` (stakeholder) + `tab-technical` (deep dive) instead. The `tab-app` tab is also hidden when `demo: false`.
3. `<script src="../project-page.js">` — renders the header, tabs, and swaps in the active template's content.

**To edit content, only touch the `<template>` blocks.** Do not modify `project-page.js` or `project.css` unless you need to add a new CSS utility.

## Adding a new project

1. Copy `projects/kaggle.html` to `projects/<your-id>.html`.
2. Update the `window.PROJECT = { ... }` block.
3. Fill in the three `<template>` tabs.
4. Add a matching entry to the `PROJECTS` array in **both** `index.html` (if featured) and `all-projects.html`.

## Status conventions

- `"live"` — finished and deployed. Green pulsing dot.
- `"wip"` — actively in progress. Amber pulsing dot.
- `"archived"` — old, kept for reference. Static grey dot.

## Tab content guidelines

### Write-up tab
- Long-form, markdown-style. Use `<h2>` for top sections, `<h3>` for subsections.
- Suggested structure: **Overview · Problem · Approach · Results · What I Learned**.
- Include images: `<img src="../assets/<id>-fig1.png" alt="..." />` (create an `assets/` folder if needed).
- Inline code: `<code>cv_score()</code>`. Code blocks: `<pre><code class="lang-python">...</code></pre>`.

### Code tab
- Link to the GitHub repo.
- Show repo structure with `<pre class="tree"><code>...</code></pre>`.
- 1–3 key snippets that show the interesting bits (not boilerplate).

### App tab
- If there's a hosted demo, embed it: `<iframe src="https://..." style="width:100%;height:600px;border:1px solid var(--border);border-radius:8px"></iframe>`.
- If not, leave the `<div class="app-coming-soon">` block, OR set `demo: null` in `window.PROJECT` and the App tab will be hidden entirely.

## Editing the landing page

`index.html` has the projects array near the top:

```js
const PROJECTS = [
  { id: "kaggle", index: "01", title: "Kaggle Competitions", ... },
  ...
];
```

The first 4 with `featured: true` show on the landing. To swap which 4 are featured, toggle the flag.

## Editing the archive

`all-projects.html` has its own `PROJECTS` array — same shape, but should include **every** project (past, present, and archived). Keep it in sync when you add projects.

## Personal details to update

- **Photo** — the gradient placeholder in `index.html` reads `[ photo ]`. Replace the placeholder `<div>` with `<img src="../assets/photo.jpg" alt="William Catt" style="width:140px;height:140px;border-radius:14px;object-fit:cover" />`.
- **Bio** — the `<p>` directly under the `<h1>William Catt</h1>` in `index.html`.
- **Links** — search `github.com/WillCatt` and update if your handle changes. LinkedIn and email also live in the bio cell.

## Local preview

```bash
python -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000`.

## Deploy

**Cloudflare Pages** (recommended):
1. Push to GitHub.
2. pages.cloudflare.com → Create project → connect repo.
3. Leave build command and output dir **blank**.
4. Deploy. Custom domain optional.

**GitHub Pages**:
1. Create repo `WillCatt/WillCatt.github.io`.
2. Push files to `main` root.
3. Settings → Pages → Source: `main` / `/ (root)`.
4. Live at `https://willcatt.github.io`.

## Design system (don't break)

- **Fonts** — Space Grotesk (display), JetBrains Mono (code).
- **Palette** — warm ivory (`#faf8f4`) bg, dark brown (`#1a1714`) text, amber accent (`oklch(52% 0.14 50)`), green live indicator, amber wip indicator.
- All colors are CSS variables in `:root` — change the variables, not individual values.

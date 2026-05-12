# William Catt — Data Science Portfolio

Static HTML portfolio. No build step.

## Quick start

```bash
# Local preview
python -m http.server 8000
```

## Structure

- `index.html` — landing page with featured projects
- `all-projects.html` — full searchable archive
- `projects/*.html` — individual project detail pages (write-up / code / app tabs)
- `project.css` + `project-page.js` — shared layer for project pages

## Editing

See **CLAUDE.md** for full instructions on adding projects, editing tab content, and deploying.

## Deploy

Push to GitHub, then point Cloudflare Pages or GitHub Pages at the repo. No build command needed.

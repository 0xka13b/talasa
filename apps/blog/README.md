# @talasa/blog

Markdown-driven static blog built with Astro (`pnpm build` → plain files in
`dist/`, hostable anywhere).

## Develop

```bash
pnpm --filter @talasa/blog dev      # http://localhost:4321
pnpm --filter @talasa/blog build    # -> apps/blog/dist
pnpm --filter @talasa/blog check-types
```

## Write a post

Drop a Markdown file in `src/content/blog/`:

```md
---
title: "My post"
description: "One-line summary (used for SEO/OG)."
pubDate: 2026-06-29
# updatedDate: 2026-07-01   # optional
# heroImage: /images/x.png  # optional, served from public/
---

Body in Markdown.
```

The filename becomes the URL slug (`/blog/<filename>/`). Invalid frontmatter
fails the build.

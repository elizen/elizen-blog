# Design QA — Elizen reading-column redesign

## Source evidence

- Live references captured from `https://haohailong.net/` and the existing `https://elizen.me/` site.
- Reference screenshots: `work/reference-home.png`, `work/reference-article.png`.
- Visual comparison captures: `work/elizen-blog/qa-home-comparison.png`, `work/elizen-blog/qa-article-comparison.png`.

## Implementation

- Production source: `elizen/elizen-blog`, Hugo `0.119.0`, branch `redesign/reading-column`.
- Changed theme files: `themes/ivy/layouts/partials/header.html`, `themes/ivy/layouts/partials/comments.html`, `themes/ivy/static/css/custom.css`.
- Hybrid pass adds a template-backed homepage hero and real-content archive in `themes/ivy/layouts/_default/home.html`, plus the preferred prototype brand note in `themes/ivy/layouts/partials/tagline.html`.
- Preview captures: `qa-home-desktop.png`, `qa-article-desktop.png`, `qa-home-mobile.png`, `qa-article-mobile.png`.

## Visual checks

- Desktop viewport: 1280×720.
- Mobile viewport: 390×844.
- Header is a restrained horizontal rail on desktop and a two-row menu control on mobile.
- Article title, metadata, divider, body copy, headings, images, and vermilion blockquote rule follow the selected quiet reading-column direction.
- Article body computed style: Noto Serif SC fallback stack, 18px, 30.6px line height, 820px content column on desktop.
- Mobile article computed style: 36px title, 17px body, 31.45px line height, 350px content column, no horizontal overflow.
- Homepage list retains all real Hugo content and remains readable as a date/title archive.
- Homepage empty shared title wrapper is hidden so the preferred hero composition starts immediately after the masthead instead of an orphan divider and extra blank band.
- Custom stylesheet uses a versioned query string so this correction is visible immediately after deployment without a stale CSS cache.
- Preferred 4173 visual direction is now combined with production content: expressive homepage masthead, “现在” aside, article summaries, and the existing Hugo routes/content.
- Mobile homepage at 390px keeps the hero readable, prevents archive rows from becoming two columns, and preserves the working menu toggle.

## Interaction checks

- Homepage navigation links resolve to the existing Hugo routes.
- Mobile menu control was clicked and verified to set `#menu-check` to checked and reveal all six navigation links.
- Existing content image and article routes remain intact.

## Build checks

- `hugo v0.119.0 --minify --destination public-redesign` passed: 304 Chinese pages, 12 English pages.
- Hugo development server renders homepage and article routes.
- Fresh homepage console check: no errors or warnings.
- Article page has one third-party Twikoo network rejection (`Uncaught (in promise) 0`) from the existing external comments service; it does not affect layout, navigation, content rendering, or the redesign CSS. It is recorded as external integration noise, not a visual/product blocker.

## Findings

- No P0–P2 visual, responsive, or interaction issues found.
- Remaining external Twikoo noise is outside the template redesign and should be checked against the production comments endpoint separately.

final result: passed

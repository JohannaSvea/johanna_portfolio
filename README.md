# Johanna Weigel – Portfolio

A static, single-page portfolio website. No build step and no framework: plain HTML, CSS and JavaScript.
All texts and images are loaded from the `content/` folder, so the site is updated by editing JSON files
and dropping images into folders.

## Structure

```
index.html                  The page (about / projects / initiatives / project detail views)
assets/
  css/styles.css            All styles – colours, fonts and sizes are variables at the top
  js/script.js              Routing, rendering of the JSON content, map, photo stack, scroll effects
  fonts/                    Lexend Giga (variable font)
  map/world-land.json       World outline (Natural Earth, public domain)
content/
  about.json                About page: intro text, education, work, skills, awards, …
  projects.json             Projects (cards, map dots, detail pages)
  initiatives.json          Initiatives (same format as projects)
  photos/about_me/          Photos for the card stack on the about page
  photos/projects/          Card images of projects and initiatives
docs/page_description.md    Original design brief
tools/                      Helper scripts for preparing photos (not used by the website)
```

## Run locally

The content is loaded with `fetch`, which browsers block for files opened directly from disk.
Start a small web server in this folder:

```bash
python -m http.server 8000
```

and open <http://localhost:8000>.

## Editing content

### Text formatting (Markdown)

All text values in the JSON files may use a small Markdown subset:

| Write                        | Result                                   |
| ---------------------------- | ---------------------------------------- |
| `[label](https://…)`         | link (external links open in a new tab)  |
| `**bold**`                   | **bold**                                 |
| `*italic*`                   | *italic*                                 |
| `\n`                         | line break                               |
| `\n\n`                       | new paragraph                            |
| lines starting with `- `     | bullet list                              |

HTML is not allowed and is shown as plain text.

### Projects and initiatives

`content/projects.json` and `content/initiatives.json` are lists. Whether an entry appears under
*projects* or *initiatives* depends only on the file it is in. New entries appear automatically on the
overview page, on the map and as a detail page.

```jsonc
{
  "slug": "ghana-weather",                 // unique id, used in the URL: #project/ghana-weather
  "title": "How can …?",
  "subtitle": "Designing across …",
  "location": "Ghana",                     // shown in the tag "Ghana · 2026"
  "year": 2026,
  "coordinates": [9.74, -0.78],            // [latitude, longitude]; several places: [[lat, lng], [lat, lng]]
  "image": "content/photos/projects/PO-Ghana.png",   // landscape image, about 2.17 : 1
  "images": [                                      // optional: shown under "On this page", same width, fade on scroll
    { "image": "content/photos/FS/dinner.jpg", "caption": "Community dinner" }
  ],
  "color": "#5E719A",                      // card colour; blue colours get blue text, others green
  "table": { "topic": "…", "team": "…" },  // "Project overview" table – any keys, shown in this order
  "body": [ { "heading": "Research Gap", "text": "…" } ]
}
```

The `body` array can also include inline media blocks between text sections:

```json
{ "type": "image", "image": "content/photos/example.png", "caption": "Optional caption" }
{ "type": "youtube", "videoId": "S3GtVNBZQuQ", "title": "Optional accessible title" }
```

YouTube videos appear as thumbnails and load the embedded player when clicked.

Card colour palette: `#5E719A`, `#98AEDE`, `#C6DCFF`, `#353F1E`, `#5F6D3B`, `#B8C792`.

### About page

`content/about.json`:

- `intro.heading`, `intro.text`, `intro.contact` – the first section.
- `intro.photoFolder` – the folder used for the photo stack (default `content/photos/about_me`).
- `sections` – the CV blocks. Each has a `heading`, a `column` (`left` / `right`) and `entries`.
  An entry can have `meta` (dates, place), `title`, `organisation`, `label`, `text`, and `details`
  (`details` turns the entry into a collapsible dropdown).

### About-page photos

Every image in `content/photos/about_me/` (`.jpg`, `.png`, `.webp`, `.avif`, `.gif`) is shown in the card
stack automatically – no list to maintain.

- **Order:** alphabetical by file name. Prefix names with `01_`, `02_`, … to control it.
- **Format:** the cards are 4 : 5 (portrait). Other formats are cropped to fill the card from the centre.
- **Size:** keep images around 1200–1600 px on the long side (a few hundred KB) so the page loads fast.

How the folder is read:

- **Locally** (`python -m http.server`, VS Code Live Server): via the server's directory listing.
- **On GitHub Pages** (`<user>.github.io/<repo>/`): via the public GitHub API, which lists the files of
  the repository's default branch. Pages must therefore be published from the default branch.
- **Other hosting** (Netlify, own server, …): only works if the server shows directory listings;
  otherwise the photo stack is hidden.

## Customising the look

At the top of `assets/css/styles.css`:

- `--bg`, `--primary`, `--secondary` – background and text colours
- `--land` – map colour
- `--text` (body text) and `--text-lg` (intro paragraphs) – font sizes
- `--title`, `--title-sm` – heading sizes
- `--margin-x`, `--margin-y` – page margins

## Credits

- Map projection: Equal Earth (Šavrič, Patterson & Jenny, 2018); land outline: [Natural Earth](https://www.naturalearthdata.com/) (public domain)
- Fonts: [Lexend Giga](https://fonts.google.com/specimen/Lexend+Giga) (bundled) and [Quattrocento](https://fonts.google.com/specimen/Quattrocento) (Google Fonts), both SIL Open Font License
- Icons: [Material Symbols](https://fonts.google.com/icons) (Apache 2.0)

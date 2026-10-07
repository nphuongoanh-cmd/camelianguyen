# Papier Pivoine · le club

The companion app for the Papier Pivoine activity books: one web app (a PWA, so readers can add it to their phone's home screen) where each book, published or future, is an entry on the shelf.

For each book, readers get:

- **À imprimer**: bonus PDFs to print
- **Colorier**: coloring pages to color on screen with a finger (saved on the device, exportable as an image)
- **Mots mêlés**: a word search with a new grid each time
- **Écrire**: bonus writing prompts, saved only on the reader's device, exportable as a .txt file

Readers unlock a book by answering a question that only someone holding the book can answer (for example "Open your book at page 42: what is the first word?"). This works for books that are already printed, so nothing needs to change in them. For future books, you can also print a QR code that links straight to the book's page, for example `https://<app address>/#/livre/automne`.

All the copy in the app is in French, and nothing is sent to a server: no account, no tracking.

## Before going live: what to fill in

Everything is in `data/books.json`. Anything marked `À REMPLIR` is a placeholder.

1. **Covers**: put `cover_etsi.png`, `cover_automne.png` and `cover_hiver.png` (from the Papier Pivoine kit) in `assets/covers/`. Until they're there, each book shows a coloured card with its title.
2. **Unlock question**: in `unlock.question`, pick a page and ask for its first word. Then open `tools/answer-hash.html` in a browser, type the answer, and paste the code into `answerHash`. The placeholder answer for all three books is currently `pivoine`.
3. **Printables**: put the PDFs in `assets/printables/` and set `"file": "assets/printables/<name>.pdf"`. Items with `"file": null` show « Bientôt ».
4. **Writing prompts** (`prompts`): write them in your own voice.
5. **Word lists** (`words`): change them freely. Accents are removed automatically.
6. **Shop links** (`shopUrl`): currently point to papierpivoine.fr.

## Adding a new book

Copy one entry in `books`, give it a new `id` (lowercase, no spaces, e.g. `printemps`), and fill in the fields. Remove the matching line from `comingSoon`. No code changes needed.

## Trying it on your computer

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Putting it online

Any static hosting works: GitHub Pages (Settings → Pages → deploy from this branch), Netlify, or a folder on papierpivoine.fr (for example `papierpivoine.fr/club/`). It must be served over https for the "add to home screen" install and the unlock check to work.

## Limits of this prototype

- The unlock answer is checked in the reader's browser. It keeps casual visitors out, but someone technical could get around it. That's fine for bonus pages. If you later want real accounts or to collect emails at unlock, that needs a small backend or a service like Kit.
- Coloring pages are built from the signature peony. To add more, they need line art with closed shapes (see `js/coloring.js`).

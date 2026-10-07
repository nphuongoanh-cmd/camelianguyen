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

## One-click polls (for Kit emails)

Each answer in your email is its own link. When a subscriber taps one, `sondage.html` opens, saves their vote with their email address in a Google Sheet, and says thank you. That's one tap, with no form to fill in. If they change their mind, they can tap another answer on that page (or in the email), and it replaces their first vote. It works for the welcome email and for every monthly newsletter.

### Setup (once, about 10 minutes)

1. Create a new Google Sheet (for example "Papier Pivoine · sondages").
2. In the Sheet, go to **Extensions → Apps Script**. Delete what's there, paste in the contents of `poll-backend/Code.gs`, and save.
3. In the function list at the top, pick **setup** and click **Run**. Google asks for permission to use your Sheet: accept. This creates two tabs, **Polls** (with an example poll called `bienvenue`) and **Votes**.
4. Click **Deploy → New deployment**, choose the type **Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone**, then click **Deploy**. Copy the URL that ends in `/exec`.
5. Paste that URL into `data/sondage.json` in place of the `À REMPLIR` text, and put the site online (see "Putting it online").

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

### Each new poll (for example each month)

1. Add a row to the **Polls** tab: an `id`, the question, 2 to 6 answers, an optional thank-you message, and `yes` or `no` to show subscribers the results after they vote.
   Use letters in the id, like `octobre-2026`. A date-like id such as `2026-10` gets turned into a date by Google Sheets.
2. Open `tools/poll-links.html` on your site (for example `https://<site>/tools/poll-links.html`), type the id, and click **Make the links**.
3. In Kit, either add one button per answer and paste its link, or paste the ready-made HTML into an HTML block.

Votes show up in the **Votes** tab: date, poll, answer, and email. You can filter, sort or make a chart of them there.

### Good to know

- The link includes `{{ subscriber.email_address }}`, which Kit fills in when it sends. In a forwarded email or a test send, the vote is still counted, without an email address.
- The page removes the email address from the address bar right away, and the page is hidden from search engines.
- The vote is sent by the page's script, not by the link itself, so most email security scanners that check links don't create fake votes. A few scanners do run scripts. If you ever see a vote that looks wrong, the subscriber's latest tap always replaces it.
- Anyone who knows how the link works could vote using someone else's email address. That's fine for a newsletter poll, but don't use it for anything that matters more.

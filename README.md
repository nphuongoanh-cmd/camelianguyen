# Papier Pivoine · one-click polls

One-click polls for Papier Pivoine emails sent with Kit (the welcome email and the monthly newsletter). Subscribers tap an answer in the email and their vote is saved with their email address in a Google Sheet.

- `sondage.html` and `js/poll.js`: the page that opens when a subscriber taps an answer
- `poll-backend/Code.gs`: the Google Apps Script that saves votes in your Google Sheet
- `data/sondage.json`: the address of that script
- `avis.html` and `js/avis.js`: the feedback forms ("Ton avis sur…"), with their questions in `data/avis.json`
- `tools/poll-links.html`: makes the links to paste into Kit
- `index.html`: sends anyone who opens the site's home page to papierpivoine.fr

## Putting it online

Any static hosting works: GitHub Pages (Settings → Pages → deploy from a branch), Netlify, or a folder on papierpivoine.fr. It must be served over https.

To try it on your computer, run `python3 -m http.server 8000` and open http://localhost:8000/tools/poll-links.html.

## How it works

Each answer in your email is its own link. When a subscriber taps one, `sondage.html` opens, saves their vote with their email address in a Google Sheet, and says thank you. That's one tap, with no form to fill in. If they change their mind, they can tap another answer on that page (or in the email), and it replaces their first vote. It works for the welcome email and for every monthly newsletter.

### Setup (once, about 10 minutes)

1. Create a new Google Sheet (for example "Papier Pivoine · sondages").
2. In the Sheet, go to **Extensions → Apps Script**. Delete what's there, paste in the contents of `poll-backend/Code.gs`, and save.
3. In the function list at the top, pick **setup** and click **Run**. Google asks for permission to use your Sheet: accept. This creates two tabs: **Polls**, with the welcome poll `bienvenue` already filled in, and **Votes**.
4. Click **Deploy → New deployment**, choose the type **Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone**, then click **Deploy**. Copy the URL that ends in `/exec`.
5. Paste that URL into `data/sondage.json` in place of the `À REMPLIR` text, and put the site online (see "Putting it online" above).

If you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

### Each new poll (for example each month)

1. Add a row to the **Polls** tab:
   - `id`: use letters, like `octobre-2026`. A date-like id such as `2026-10` gets turned into a date by Google Sheets.
   - `intro`: optional small pink line above the question.
   - `question`, then 2 to 8 answers in `option 1` to `option 8`.
   - `free-text option #`: optional. The number of an answer that also opens a text box, like "Autre chose (je te raconte)".
   - `note`: optional grey line under the answers.
   - `thank-you message`: optional.
   - `show results`: `yes` or `no`, to show subscribers the results after they vote.
2. Open `tools/poll-links.html` on your site (for example `https://<site>/tools/poll-links.html`), type the id, and click **Make the links**.
3. In Kit, paste the ready-made HTML into an HTML block. It has the same design as the poll in the welcome email. You can also add one button per answer and paste its link.

Votes show up in the **Votes** tab: date, poll, answer, email, and the message typed in the text box, if any. You can filter, sort or make a chart of them there.

If you set up the Sheet with an older version of `Code.gs`, run **setup** again after updating the script. It adds the new columns without touching your polls or votes.

### Good to know

- The link includes `{{ subscriber.email_address }}`, which Kit fills in when it sends. In a forwarded email or a test send, the vote is still counted, without an email address.
- The page removes the email address from the address bar right away, and the page is hidden from search engines.
- The vote is sent by the page's script, not by the link itself, so most email security scanners that check links don't create fake votes. A few scanners do run scripts. If you ever see a vote that looks wrong, the subscriber's latest tap always replaces it.
- Anyone who knows how the link works could vote using someone else's email address. That's fine for a newsletter poll, but don't use it for anything that matters more.

## Feedback forms

Two forms replace the Tally ones: `carnet` ("Ton avis sur ton carnet") and `mental-leger` ("Ton avis sur Mental Léger"). Their questions are in `data/avis.json`.

- **In an email:** type the form id in the link maker and paste the HTML into Kit. The email shows the form's first question. One tap saves that answer and opens the rest of the form with it filled in.
- **Anywhere else** (website, QR code in a book): link to `avis.html?f=carnet` or `avis.html?f=mental-leger`. The whole form shows, nothing filled in.

Answers go in the **Avis** tab: one row per person and form, with the date, form, email, first name, notebook, stars, review and sharing choice. The first name comes from Kit, or from the box that shows when someone picks "Oui, avec mon prénom".

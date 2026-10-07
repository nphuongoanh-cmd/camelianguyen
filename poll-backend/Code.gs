// Papier Pivoine one-click polls: a Google Apps Script web app backed by the
// Google Sheet it is attached to. sondage.html sends votes here; the sheet
// holds the poll questions ("Polls" tab) and every vote ("Votes" tab).
// Setup steps are in README.md, section "One-click polls".

const POLLS_SHEET = 'Polls';
const VOTES_SHEET = 'Votes';
const MAX_OPTIONS = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Run once from the Apps Script editor: creates both tabs with an example poll.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(POLLS_SHEET)) {
    const sheet = ss.insertSheet(POLLS_SHEET);
    const header = ['id', 'question'];
    for (let i = 1; i <= MAX_OPTIONS; i++) header.push('option ' + i);
    header.push('thank-you message', 'show results (yes/no)');
    sheet.appendRow(header);
    sheet.appendRow(['bienvenue', 'Qu’est-ce qui t’amène ici ?',
      'Je suis souvent à batterie faible', 'J’aime écrire pour me poser', 'Je cherche des activités cocooning', 'Un peu de tout ça', '', '',
      'Merci, ça m’aide à t’écrire des lettres qui te ressemblent.', 'yes']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  }
  if (!ss.getSheetByName(VOTES_SHEET)) {
    const sheet = ss.insertSheet(VOTES_SHEET);
    sheet.appendRow(['date', 'poll', 'option #', 'answer', 'email']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
}

// GET ?poll=<id>: the poll's question and options (no vote recorded).
function doGet(e) {
  const poll = findPoll_((e.parameter.poll || '').trim());
  if (!poll) return json_({ ok: false, error: 'unknown_poll' });
  return json_({ ok: true, poll: publicPoll_(poll), results: poll.showResults ? tally_(poll) : null });
}

// POST {poll, choice, email}: records the vote. One vote per email per poll:
// voting again replaces the earlier answer. Votes without a valid email
// (e.g. a forwarded email or a test send) are kept as anonymous.
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }

  const poll = findPoll_(String(body.poll || '').trim());
  if (!poll) return json_({ ok: false, error: 'unknown_poll' });
  const choice = Number(body.choice);
  const option = poll.options.find(o => o.n === choice);
  if (!option) return json_({ ok: false, error: 'unknown_option' });
  const email = String(body.email || '').trim().toLowerCase();
  const validEmail = EMAIL_RE.test(email) && email.length <= 254 ? email : '';

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VOTES_SHEET);
    const row = [new Date(), poll.id, option.n, option.label, validEmail];
    let existing = -1;
    if (validEmail) {
      const values = sheet.getDataRange().getValues();
      for (let i = values.length - 1; i >= 1; i--) {
        if (values[i][1] === poll.id && values[i][4] === validEmail) { existing = i + 1; break; }
      }
    }
    if (existing > 0) sheet.getRange(existing, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true, poll: publicPoll_(poll), choice: option.n, results: poll.showResults ? tally_(poll) : null });
}

function findPoll_(id) {
  if (!id) return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POLLS_SHEET);
  const rows = sheet.getDataRange().getDisplayValues();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (String(row[0]).trim() !== id) continue;
    const options = [];
    for (let i = 0; i < MAX_OPTIONS; i++) {
      const label = String(row[2 + i] || '').trim();
      if (label) options.push({ n: i + 1, label: label });
    }
    return {
      id: id,
      question: String(row[1]).trim(),
      options: options,
      thanks: String(row[2 + MAX_OPTIONS] || '').trim(),
      showResults: /^(yes|oui|y|true|1)$/i.test(String(row[3 + MAX_OPTIONS] || '').trim()),
    };
  }
  return null;
}

function publicPoll_(poll) {
  return { id: poll.id, question: poll.question, options: poll.options, thanks: poll.thanks, showResults: poll.showResults };
}

function tally_(poll) {
  const values = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VOTES_SHEET).getDataRange().getValues();
  const counts = {};
  poll.options.forEach(o => { counts[o.n] = 0; });
  let total = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === poll.id && values[i][2] in counts) { counts[values[i][2]]++; total++; }
  }
  return { counts: counts, total: total };
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

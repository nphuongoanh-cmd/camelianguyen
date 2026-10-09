// Papier Pivoine one-click polls: a Google Apps Script web app backed by the
// Google Sheet it is attached to. sondage.html sends votes here; the sheet
// holds the poll questions ("Polls" tab) and every vote ("Votes" tab).
// Setup steps are in README.md.

const POLLS_SHEET = 'Polls';
const VOTES_SHEET = 'Votes';
const MAX_OPTIONS = 8;
const MAX_TEXT = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Columns are found by their header, so they can be in any order.
const POLL_COLUMNS = ['id', 'intro (above the question)', 'question'];
for (let i = 1; i <= MAX_OPTIONS; i++) POLL_COLUMNS.push('option ' + i);
POLL_COLUMNS.push('free-text option # (optional)', 'note (under the answers)', 'thank-you message', 'show results (yes/no)');
const VOTE_COLUMNS = ['date', 'poll', 'option #', 'answer', 'email', 'message', 'vote id'];

const WELCOME = {
  'id': 'bienvenue',
  'intro (above the question)': 'Avant de te laisser, j’aimerais savoir une chose',
  'question': 'Qu’est-ce qui te pèse le plus en ce moment\u00a0?',
  'option 1': 'Ma tête ne s’arrête jamais vraiment',
  'option 2': 'Je rejoue les conversations le soir',
  'option 3': 'Je rentre vidée, sans toujours savoir pourquoi',
  'option 4': 'Je me parle plus durement qu’à une amie',
  'option 5': 'Je dis oui alors que je voudrais dire non',
  'option 6': 'Je me sens seule, même entourée',
  'option 7': 'Autre chose (je te raconte)',
  'free-text option # (optional)': 7,
  'note (under the answers)': 'Un clic suffit. Ou réponds-moi directement\u00a0: je lis tout.',
  'thank-you message': 'Merci, ça m’aide à t’écrire des lettres qui te ressemblent.',
  'show results (yes/no)': 'no',
};
const OLD_EXAMPLE_QUESTION = 'Qu’est-ce qui t’amène ici ?';

// Run from the Apps Script editor. Creates both tabs, or adds any missing
// columns to existing ones without touching what is already there. It also
// fills in the welcome poll, unless you have already changed its question.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const polls = ss.getSheetByName(POLLS_SHEET) || ss.insertSheet(POLLS_SHEET);
  addMissingColumns_(polls, POLL_COLUMNS);
  // A short-lived version split votes into "Votes bienvenue" and "Votes mensuels":
  // bring the welcome votes back under their usual name.
  if (!ss.getSheetByName(VOTES_SHEET) && ss.getSheetByName('Votes bienvenue')) ss.getSheetByName('Votes bienvenue').setName(VOTES_SHEET);
  const votes = ss.getSheetByName(VOTES_SHEET) || ss.insertSheet(VOTES_SHEET);
  addMissingColumns_(votes, VOTE_COLUMNS);

  const header = headerOf_(polls);
  const rows = polls.getDataRange().getDisplayValues();
  let r = rows.findIndex((row, i) => i > 0 && row[header['id']].trim() === WELCOME.id);
  if (r < 0) r = rows.length;
  else if (![WELCOME.question, OLD_EXAMPLE_QUESTION, ''].includes(rows[r][header['question']].trim())) return;
  Object.keys(WELCOME).forEach(name => polls.getRange(r + 1, header[name] + 1).setValue(WELCOME[name]));
}

function addMissingColumns_(sheet, names) {
  let header = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0] : [];
  const has = name => header.some(h => h.trim().toLowerCase() === name);
  names.forEach((name, i) => {
    if (has(name)) return;
    // Put a new option column right after the previous option, everything else at the end.
    const prev = /^option (\d+)$/.test(name) ? header.findIndex(h => h.trim().toLowerCase() === names[i - 1]) : -1;
    if (prev >= 0) {
      sheet.insertColumnAfter(prev + 1);
      sheet.getRange(1, prev + 2).setValue(name);
    } else {
      sheet.getRange(1, header.length + 1).setValue(name);
    }
    header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  });
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
}

// { 'header name': column index (0-based) }
function headerOf_(sheet) {
  const header = {};
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .forEach((h, i) => { header[h.trim().toLowerCase()] = i; });
  return header;
}

// GET ?poll=<id>: the poll's question and options (no vote recorded).
function doGet(e) {
  const poll = findPoll_((e.parameter.poll || '').trim());
  if (!poll) return json_({ ok: false, error: 'unknown_poll' });
  if (!poll.showResults) return json_({ ok: true, poll: poll, results: null });
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VOTES_SHEET);
  const col = headerOf_(sheet);
  const rows = sheet.getDataRange().getValues().map(row => ({ poll: row[col['poll']], n: row[col['option #']] }));
  return json_({ ok: true, poll: poll, results: tally_(poll, rows) });
}

// POST {poll, choice, email, vid, text}: records the vote. One vote per person
// per poll: voting again replaces the earlier answer. A person is their email,
// or, without a valid email (a forwarded email, a test send), the random vote
// id their browser tab sends. `text` is the free-text answer, when there is one.
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }

  const poll = findPoll_(String(body.poll || '').trim());
  if (!poll) return json_({ ok: false, error: 'unknown_poll' });
  const option = poll.options.find(o => o.n === Number(body.choice));
  if (!option) return json_({ ok: false, error: 'unknown_option' });
  const email = String(body.email || '').trim().toLowerCase();
  const validEmail = EMAIL_RE.test(email) && email.length <= 254 ? email : '';
  const vid = validEmail ? '' : String(body.vid || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_TEXT) : null;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let results = null;
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(VOTES_SHEET);
    const col = headerOf_(sheet);
    const width = sheet.getLastColumn();
    // Read the votes once: to find this person's earlier vote, and to count.
    const values = sheet.getDataRange().getValues();
    const voteRows = values.map(row => ({ poll: row[col['poll']], n: row[col['option #']] }));
    let existing = -1;
    if (validEmail || vid) {
      for (let i = values.length - 1; i >= 1; i--) {
        const same = validEmail ? values[i][col['email']] === validEmail : values[i][col['vote id']] === vid;
        if (values[i][col['poll']] === poll.id && same) { existing = i; break; }
      }
    }
    // A message already sent is kept, even if the answer changes afterwards.
    const keep = existing > 0 ? values[existing][col['message']] : '';
    const row = new Array(width).fill('');
    if (existing > 0) values[existing].forEach((v, i) => { row[i] = v; });
    row[col['date']] = new Date();
    row[col['poll']] = poll.id;
    row[col['option #']] = option.n;
    row[col['answer']] = option.label;
    row[col['email']] = asText_(validEmail);
    row[col['message']] = asText_(text !== null ? text : keep);
    row[col['vote id']] = vid;

    if (existing > 0) {
      sheet.getRange(existing + 1, 1, 1, width).setValues([row]);
      voteRows[existing] = { poll: poll.id, n: option.n };
    } else {
      sheet.appendRow(row);
      voteRows.push({ poll: poll.id, n: option.n });
    }
    if (poll.showResults) results = tally_(poll, voteRows);
    SpreadsheetApp.flush(); // so the next vote, once it gets the lock, sees this one
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true, poll: poll, choice: option.n, results: results });
}

// Poll questions are kept in memory for a minute, so most votes skip reading
// the Polls tab. An edit to the Polls tab can take up to a minute to show.
function findPoll_(id) {
  if (!id) return null;
  const cache = CacheService.getScriptCache();
  const key = 'poll2:' + id;
  const cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  const poll = readPoll_(id);
  if (poll) cache.put(key, JSON.stringify(poll), 60);
  return poll;
}

function readPoll_(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(POLLS_SHEET);
  const col = headerOf_(sheet);
  const cell = (row, name) => name in col ? String(row[col[name]] || '').trim() : '';
  const rows = sheet.getDataRange().getDisplayValues();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (cell(row, 'id') !== id) continue;
    const options = [];
    for (let i = 1; i <= MAX_OPTIONS; i++) {
      const label = cell(row, 'option ' + i);
      if (label) options.push({ n: i, label: label });
    }
    const freeText = Number(cell(row, 'free-text option # (optional)')) || null;
    return {
      id: id,
      intro: cell(row, 'intro (above the question)'),
      question: cell(row, 'question'),
      options: options,
      freeText: options.some(o => o.n === freeText) ? freeText : null,
      note: cell(row, 'note (under the answers)'),
      thanks: cell(row, 'thank-you message'),
      showResults: /^(yes|oui|y|true|1)$/i.test(cell(row, 'show results (yes/no)')),
    };
  }
  return null;
}

// rows: [{ poll, n }], the first one being the header.
function tally_(poll, rows) {
  const counts = {};
  poll.options.forEach(o => { counts[o.n] = 0; });
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].poll === poll.id && rows[i].n in counts) { counts[rows[i].n]++; total++; }
  }
  return { counts: counts, total: total };
}

// Stops Sheets from reading what a subscriber typed as a formula.
function asText_(s) {
  return typeof s === 'string' && /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

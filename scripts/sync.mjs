// Rebuilds every stack's progress.json and README AUTO blocks from stacks/<stack>/modules/,
// and the stacks table in the root README.
// Node >= 18, no dependencies, idempotent. Usage: node scripts/sync.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STACKS = join(ROOT, 'stacks');
const DASH = '—';
const NUMBERED = /^\d{2}-/;
const STACK_NAME = /^[a-z0-9][a-z0-9-]*$/;
const GLYPH = {
  'not started': '○',
  learning: '◔',
  building: '◑',
  reviewing: '◕',
  done: '●',
};
const IN_PROGRESS = ['learning', 'building', 'reviewing'];

// ---------- fs helpers ----------

const read = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const entries = (path) =>
  existsSync(path) ? readdirSync(path, { withFileTypes: true }) : [];

const subdirs = (path, pattern) =>
  entries(path)
    .filter((e) => e.isDirectory() && pattern.test(e.name))
    .map((e) => e.name)
    .sort();

const files = (path) => entries(path).filter((e) => e.isFile()).map((e) => e.name);

function write(path, content) {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return;
  writeFileSync(path, content);
}

// ---------- parsing ----------

const unquote = (s) => (/^(['"]).*\1$/.test(s) ? s.slice(1, -1) : s);

function parseValue(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    return inner ? inner.split(',').map((s) => unquote(s.trim())) : [];
  }
  return unquote(v);
}

function frontmatter(text) {
  const lines = text.split('\n');
  const data = {};
  if (lines[0]?.trim() !== '---') return data;
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') break;
    const m = line.match(/^([\w-]+):(.*)$/);
    if (m) data[m[1]] = parseValue(m[2]);
  }
  return data;
}

function checklist(text) {
  let inside = false;
  let total = 0;
  let done = 0;
  for (const line of text.split('\n')) {
    if (/^##\s/.test(line)) {
      inside = /^##\s+Checklist\s*$/.test(line);
      continue;
    }
    const m = inside && line.match(/^\s*- \[([ xX])\]/);
    if (m) {
      total++;
      if (m[1] !== ' ') done++;
    }
  }
  return { total, done };
}

// ---------- math ----------

const percent = (done, total) => (total ? Math.round((done / total) * 100) : 0);

const mean = (xs) =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

const toNumber = (v) => (v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

const blank = (v) => v === undefined || v === null || v === '' || v === DASH;

// ---------- model ----------

// Lessons can be written ahead of time (/learn all mode=docs), so a topic
// counts as started only once it has tasks.
function topicStatus(tasks) {
  const core = tasks.filter((t) => t.level !== 'stretch');
  if (core.length && core.every((t) => t.verdict === 'pass')) return 'done';
  if (core.length && core.every((t) => t.status === 'done')) return 'reviewing';
  if (core.some((t) => t.status === 'done')) return 'building';
  if (tasks.length > 0) return 'learning';
  return 'not started';
}

// Paths in the model are relative to the stack folder, like the links in its README.
function loadTopic(stackDir, moduleSlug, slug, scores) {
  const path = `modules/${moduleSlug}/${slug}`;
  const dir = join(stackDir, path);
  const text = read(join(dir, 'README.md'));
  const fm = frontmatter(text);
  const docs = files(join(dir, 'docs')).filter((f) => f.endsWith('.md')).length;

  const tasks = subdirs(join(dir, 'tasks'), /^T/).flatMap((name) => {
    const taskFile = join(dir, 'tasks', name, 'TASK.md');
    if (!existsSync(taskFile)) return [];
    const task = frontmatter(read(taskFile));
    const reviewFile = join(dir, 'reviews', name, 'REVIEW.md');
    const review = existsSync(reviewFile) ? frontmatter(read(reviewFile)) : null;
    return [{
      id: task.id || name,
      level: task.level,
      status: task.status,
      reviewed: review !== null,
      score: review ? toNumber(review.score) : null,
      verdict: review?.verdict,
      date: review?.date,
    }];
  });

  const taskScores = tasks.map((t) => t.score).filter((s) => s !== null);
  scores.push(...taskScores);

  return {
    slug,
    path,
    title: fm.title || slug,
    tech: blank(fm.tech) ? null : fm.tech,
    status: topicStatus(tasks),
    docs,
    cheatsheet: existsSync(join(dir, 'docs', 'cheatsheet.md')) ? `${path}/docs/cheatsheet.md` : null,
    tasks: { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length },
    reviewed: tasks.filter((t) => t.reviewed).length,
    score: mean(taskScores),
    checklist: checklist(text),
  };
}

function loadModule(stackDir, slug, scores) {
  const dir = join(stackDir, 'modules', slug);
  const readme = join(dir, 'README.md');
  const title = (existsSync(readme) && frontmatter(read(readme)).title) || slug;
  const topics = subdirs(dir, NUMBERED)
    .filter((t) => existsSync(join(dir, t, 'README.md')))
    .map((t) => loadTopic(stackDir, slug, t, scores));
  const total = topics.reduce((n, t) => n + t.checklist.total, 0);
  const done = topics.reduce((n, t) => n + t.checklist.done, 0);
  return {
    slug,
    title,
    cheatsheet: existsSync(join(dir, 'cheatsheet.md')) ? `modules/${slug}/cheatsheet.md` : null,
    percent: percent(done, total),
    topicsDone: topics.filter((t) => t.status === 'done').length,
    topics,
  };
}

function loadStack(slug) {
  const dir = join(STACKS, slug);
  const readme = join(dir, 'README.md');
  const fm = existsSync(readme) ? frontmatter(read(readme)) : {};
  const scores = [];
  const modules = subdirs(join(dir, 'modules'), NUMBERED).map((m) => loadModule(dir, m, scores));
  const topics = modules.flatMap((m) => m.topics);
  const checkTotal = topics.reduce((n, t) => n + t.checklist.total, 0);
  const checkDone = topics.reduce((n, t) => n + t.checklist.done, 0);
  return {
    slug,
    dir,
    readme,
    title: fm.title || slug,
    summary: blank(fm.summary) ? null : fm.summary,
    hasStack: existsSync(join(dir, 'STACK.md')),
    hasCheatsheet: existsSync(join(dir, 'CHEATSHEET.md')),
    totals: {
      topics: topics.length,
      topicsDone: topics.filter((t) => t.status === 'done').length,
      tasks: topics.reduce((n, t) => n + t.tasks.total, 0),
      tasksDone: topics.reduce((n, t) => n + t.tasks.done, 0),
      reviewed: topics.reduce((n, t) => n + t.reviewed, 0),
      avgScore: mean(scores),
      checklist: { total: checkTotal, done: checkDone, percent: percent(checkDone, checkTotal) },
    },
    modules,
  };
}

// ---------- rendering ----------

function bar(pct) {
  const filled = Math.round(pct / 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}

const show = (v) => (blank(v) ? DASH : String(v).replace(/\|/g, '\\|'));
const showScore = (s) => (s === null ? DASH : s.toFixed(1));
const showTasks = ({ total, done }) => (total ? `${done}/${total}` : DASH);
const showSheet = (path, prefix = '') => (path ? `[sheet](${prefix}${path})` : DASH);

function renderStats(totals, date) {
  const t = totals;
  const sep = ' &nbsp;·&nbsp; ';
  return [
    `<code>${bar(t.checklist.percent)}</code>&nbsp; <b>${t.checklist.percent}%</b> mastery`,
    '',
    [
      `<b>${t.topicsDone}</b>/${t.topics} topics`,
      `<b>${t.tasksDone}</b>/${t.tasks} tasks`,
      `<b>${t.reviewed}</b> reviewed`,
      `<b>${showScore(t.avgScore)}</b> avg score`,
      `synced ${date}`,
    ].join(sep),
  ].join('\n');
}

function renderModules(modules, prefix = '') {
  if (!modules.length) return '_No modules yet. Run `/stack new <name>` to create the topic checklists._';
  const started = modules.some((m) => m.topics.some((t) => t.status !== 'not started'));
  return modules
    .map((m) => {
      const open = started
        ? m.topics.some((t) => IN_PROGRESS.includes(t.status))
        : m.slug.startsWith('01-');
      const rows = m.topics.map((t) =>
        `| ${GLYPH[t.status]} | [${show(t.title)}](${prefix}${t.path}) | ${show(t.tech)} | ${showSheet(t.cheatsheet, prefix)} | ${showTasks(t.tasks)} | ${showScore(t.score)} |`);
      return [
        open ? '<details open>' : '<details>',
        `<summary><b>${m.slug.slice(0, 2)} · ${m.title}</b>&nbsp; <code>${bar(m.percent)}</code> ${m.percent}% · ${m.topicsDone}/${m.topics.length} topics</summary>`,
        '<br>',
        '',
        ...(m.cheatsheet ? [`Module cheatsheet: [${m.title}](${prefix}${m.cheatsheet})`, ''] : []),
        '| | Topic | Tech | Cheatsheet | Tasks | Score |',
        '|:-:|:--|:--|:-:|:-:|:-:|',
        ...rows,
        '',
        '</details>',
      ].join('\n');
    })
    .join('\n\n');
}

const DEFAULT_OPEN_STACK = 'csharp';

// One collapsible section per stack; the default stack starts open, the others closed.
function renderStacks(stacks, date) {
  if (!stacks.length) return '_No stacks yet. Run `/stack new <name>` to create the first one._';
  const openSlug = stacks.some((s) => s.slug === DEFAULT_OPEN_STACK) ? DEFAULT_OPEN_STACK : stacks[0].slug;
  return stacks
    .map((s) => {
      const base = `stacks/${s.slug}`;
      const t = s.totals;
      const links = [
        existsSync(s.readme) && `[Dashboard](${base}/README.md)`,
        s.hasStack && `[STACK](${base}/STACK.md)`,
        s.hasCheatsheet && `[CHEATSHEET](${base}/CHEATSHEET.md)`,
      ].filter(Boolean).join(' &nbsp;·&nbsp; ');
      return [
        s.slug === openSlug ? '<details open>' : '<details>',
        `<summary><b>${show(s.title)}</b>&nbsp; <code>${bar(t.checklist.percent)}</code> ${t.checklist.percent}% · ${t.topicsDone}/${t.topics} topics${s.summary ? ` &nbsp;·&nbsp; <sub>${s.summary}</sub>` : ''}</summary>`,
        '<br>',
        '',
        '<div align="center">',
        '',
        renderStats(t, date),
        '',
        `<sub>${links}</sub>`,
        '',
        '</div>',
        '',
        renderModules(s.modules, `${base}/`),
        '',
        '</details>',
      ].join('\n');
    })
    .join('\n\n');
}

function replaceBlock(text, name, body, file) {
  const start = `<!-- AUTO:${name} -->`;
  const end = `<!-- /AUTO:${name} -->`;
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i < 0 || j < i) throw new Error(`${file} is missing ${start} ... ${end}`);
  return `${text.slice(0, i + start.length)}\n${body}\n${text.slice(j)}`;
}

// Keeps the file's line endings.
function updateReadme(path, blocks) {
  const raw = readFileSync(path, 'utf8');
  const crlf = raw.includes('\r\n');
  let text = raw.replace(/\r\n/g, '\n');
  const file = path.slice(ROOT.length + 1).replace(/\\/g, '/');
  for (const [name, body] of Object.entries(blocks)) text = replaceBlock(text, name, body, file);
  write(path, crlf ? text.replace(/\n/g, '\r\n') : text);
}

// ---------- main ----------

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const date = today();
const stacks = subdirs(STACKS, STACK_NAME).map(loadStack);

for (const s of stacks) {
  write(
    join(s.dir, 'progress.json'),
    `${JSON.stringify({ stack: s.slug, generatedAt: date, totals: s.totals, modules: s.modules }, null, 2)}\n`,
  );
  if (existsSync(s.readme)) {
    updateReadme(s.readme, {
      STATS: renderStats(s.totals, date),
      MODULES: renderModules(s.modules),
    });
  } else {
    console.warn(`warning: stacks/${s.slug}/README.md is missing; dashboard not written`);
  }
  const t = s.totals;
  console.log(
    `synced ${s.slug} · ${t.checklist.percent}% · ${t.topicsDone}/${t.topics} topics · ${t.tasksDone}/${t.tasks} tasks`,
  );
}

updateReadme(join(ROOT, 'README.md'), { STACKS: renderStacks(stacks, date) });
console.log(`synced README · ${stacks.length} stack${stacks.length === 1 ? '' : 's'}`);

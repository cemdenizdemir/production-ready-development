// Rebuilds progress.json and the AUTO blocks in README.md from modules/.
// Node >= 18, no dependencies, idempotent. Usage: node scripts/sync.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DASH = '—';
const NUMBERED = /^\d{2}-/;
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

function topicStatus(docs, tasks) {
  const core = tasks.filter((t) => t.level !== 'stretch');
  if (core.length && core.every((t) => t.verdict === 'pass')) return 'done';
  if (core.length && core.every((t) => t.status === 'done')) return 'reviewing';
  if (core.some((t) => t.status === 'done')) return 'building';
  if (docs > 0) return 'learning';
  return 'not started';
}

function loadTopic(moduleSlug, slug, scores) {
  const path = `modules/${moduleSlug}/${slug}`;
  const dir = join(ROOT, path);
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
    status: topicStatus(docs, tasks),
    docs,
    tasks: { total: tasks.length, done: tasks.filter((t) => t.status === 'done').length },
    reviewed: tasks.filter((t) => t.reviewed).length,
    score: mean(taskScores),
    checklist: checklist(text),
  };
}

function loadModule(slug, scores) {
  const dir = join(ROOT, 'modules', slug);
  const readme = join(dir, 'README.md');
  const title = (existsSync(readme) && frontmatter(read(readme)).title) || slug;
  const topics = subdirs(dir, NUMBERED)
    .filter((t) => existsSync(join(dir, t, 'README.md')))
    .map((t) => loadTopic(slug, t, scores));
  const total = topics.reduce((n, t) => n + t.checklist.total, 0);
  const done = topics.reduce((n, t) => n + t.checklist.done, 0);
  return {
    slug,
    title,
    percent: percent(done, total),
    topicsDone: topics.filter((t) => t.status === 'done').length,
    topics,
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

function renderModules(modules) {
  const started = modules.some((m) => m.topics.some((t) => t.status !== 'not started'));
  return modules
    .map((m) => {
      const open = started
        ? m.topics.some((t) => IN_PROGRESS.includes(t.status))
        : m.slug.startsWith('01-');
      const rows = m.topics.map((t) =>
        `| ${GLYPH[t.status]} | [${show(t.title)}](${t.path}) | ${show(t.tech)} | ${showTasks(t.tasks)} | ${showScore(t.score)} |`);
      return [
        open ? '<details open>' : '<details>',
        `<summary><b>${m.slug.slice(0, 2)} · ${m.title}</b>&nbsp; <code>${bar(m.percent)}</code> ${m.percent}% · ${m.topicsDone}/${m.topics.length} topics</summary>`,
        '<br>',
        '',
        '| | Topic | Tech | Tasks | Score |',
        '|:-:|:--|:--|:-:|:-:|',
        ...rows,
        '',
        '</details>',
      ].join('\n');
    })
    .join('\n\n');
}

function replaceBlock(text, name, body) {
  const start = `<!-- AUTO:${name} -->`;
  const end = `<!-- /AUTO:${name} -->`;
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i < 0 || j < i) throw new Error(`README.md is missing ${start} ... ${end}`);
  return `${text.slice(0, i + start.length)}\n${body}\n${text.slice(j)}`;
}

// ---------- main ----------

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const date = today();
const scores = [];
const modules = subdirs(join(ROOT, 'modules'), NUMBERED).map((m) => loadModule(m, scores));
const topics = modules.flatMap((m) => m.topics);
const checkTotal = topics.reduce((n, t) => n + t.checklist.total, 0);
const checkDone = topics.reduce((n, t) => n + t.checklist.done, 0);

const totals = {
  topics: topics.length,
  topicsDone: topics.filter((t) => t.status === 'done').length,
  tasks: topics.reduce((n, t) => n + t.tasks.total, 0),
  tasksDone: topics.reduce((n, t) => n + t.tasks.done, 0),
  reviewed: topics.reduce((n, t) => n + t.reviewed, 0),
  avgScore: mean(scores),
  checklist: { total: checkTotal, done: checkDone, percent: percent(checkDone, checkTotal) },
};

write(
  join(ROOT, 'progress.json'),
  `${JSON.stringify({ generatedAt: date, totals, modules }, null, 2)}\n`,
);

const readmePath = join(ROOT, 'README.md');
const raw = readFileSync(readmePath, 'utf8');
const crlf = raw.includes('\r\n');
let readme = raw.replace(/\r\n/g, '\n');
readme = replaceBlock(readme, 'STATS', renderStats(totals, date));
readme = replaceBlock(readme, 'MODULES', renderModules(modules));
write(readmePath, crlf ? readme.replace(/\n/g, '\r\n') : readme);

console.log(
  `synced · ${totals.checklist.percent}% · ${totals.topicsDone}/${totals.topics} topics · ${totals.tasksDone}/${totals.tasks} tasks`,
);

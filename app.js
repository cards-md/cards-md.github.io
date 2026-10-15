// Any public GitHub repo's markdown, drawn as cards (cards.md), its folders
// to browse. All of it in the visitor's browser: no server, nothing kept
// but this visit's file lists. GitHub's URL shape on this host, so a link
// is shared by changing the host:
//
//   /{owner}/{repo}                        the repo, its README
//   /{owner}/{repo}/tree/{ref}/{path}      a folder, its README under it
//   /{owner}/{repo}/blob/{ref}/{path}      a file
//
// Pages serves 404.html (this page, again) for any path it does not have,
// so every path comes here. A repo's files are listed by one call to
// GitHub's API (60 an hour for a visitor not signed in), each file's text
// from raw.githubusercontent.com (not counted against them), and jsDelivr
// in their place where GitHub refuses.

'use strict';

const page = document.getElementById('page');
const crumbs = document.querySelector('.crumbs');
const github = document.querySelector('.github');

// a file over this many bytes is linked, not drawn: a phone would take it whole
const BIG = 2_000_000;
const MARKDOWN = /\.(md|markdown|mdown|mkd)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const TEXT = /\.(txt|json|ya?ml|toml|csv|tsv|js|mjs|cjs|ts|py|rb|rs|go|swift|kt|java|c|h|cc|cpp|sh|sql|css|html|xml)$|(^|\/)(LICENSE|Makefile|Dockerfile|\.gitignore)$/i;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');

/** The path of this page, read as GitHub's: {owner, repo, kind, ref, path}, or null for the front page. */
function route(pathname) {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length < 2) return null;
  const [owner, repo, kind, ref, ...rest] = parts;
  if (kind === 'blob' || kind === 'tree') return { owner, repo, kind, ref: ref || 'HEAD', path: rest.join('/') };
  return { owner, repo, kind: 'tree', ref: 'HEAD', path: '' };
}

const here = (r, kind, path) => `/${enc(r.owner)}/${enc(r.repo)}/${kind}/${enc(r.ref)}${path ? `/${enc(path)}` : ''}`;
const raw = (r, path) => `https://raw.githubusercontent.com/${enc(r.owner)}/${enc(r.repo)}/${enc(r.ref)}/${enc(path)}`;
const onGitHub = (r, kind, path) => `https://github.com/${enc(r.owner)}/${enc(r.repo)}${path || kind === 'blob' ? `/${kind}/${enc(r.ref)}/${enc(path)}` : ''}`;

// What the site says itself: what happened, and what happens next.
class Said extends Error {}

/** A repo's files at a ref: Map path → {type: 'blob'|'tree', size}. Kept for the visit. */
async function listing(r) {
  const key = `tree ${r.owner}/${r.repo}@${r.ref}`;
  const made = ({ files, truncated }) => Object.assign(new Map(files), { truncated });
  try { const kept = sessionStorage.getItem(key); if (kept) return made(JSON.parse(kept)); } catch { /* no storage: ask again */ }
  let files;
  let truncated = false;
  const res = await fetch(`https://api.github.com/repos/${enc(r.owner)}/${enc(r.repo)}/git/trees/${enc(r.ref)}?recursive=1`);
  if (res.ok) {
    const body = await res.json();
    files = body.tree.map((e) => [e.path, { type: e.type, size: e.size ?? 0 }]);
    truncated = !!body.truncated;
  } else if (res.status === 403 || res.status === 429) {
    files = await jsdelivr(r, res);
  } else if (res.status === 404 || res.status === 422) {
    throw new Said(`GitHub has no public repo <code>${esc(r.owner)}/${esc(r.repo)}</code>${r.ref === 'HEAD' ? '' : ` at <code>${esc(r.ref)}</code>`}. A private repo is not drawn here.`);
  } else {
    throw new Said(`GitHub did not list the files (${res.status}). Reloading asks again.`);
  }
  try { sessionStorage.setItem(key, JSON.stringify({ files, truncated })); } catch { /* too big to keep: asked again next time */ }
  return made({ files, truncated });
}

/** jsDelivr's list of a repo's files, where GitHub's limit is reached. */
async function jsdelivr(r, refused) {
  const reset = Number(refused.headers.get('x-ratelimit-reset')) * 1000;
  const when = reset ? ` It resets at ${new Date(reset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : '';
  for (const ref of r.ref === 'HEAD' ? ['main', 'master'] : [r.ref]) {
    const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${enc(r.owner)}/${enc(r.repo)}@${enc(ref)}?structure=flat`);
    if (!res.ok) continue;
    if (r.ref === 'HEAD') r.ref = ref;
    const out = [];
    for (const f of (await res.json()).files) {
      const path = f.name.replace(/^\//, '');
      out.push([path, { type: 'blob', size: f.size ?? 0 }]);
      // the folders, from the files' paths
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i++) out.push([parts.slice(0, i).join('/'), { type: 'tree', size: 0 }]);
    }
    return [...new Map(out)];
  }
  throw new Said(`GitHub's limit for visitors not signed in (60 file lists an hour) is reached, and jsDelivr could not list this repo.${when} Files already open here still draw.`);
}

/** A file's text: raw.githubusercontent.com, else jsDelivr. */
async function text(r, path) {
  for (const url of [raw(r, path), `https://cdn.jsdelivr.net/gh/${enc(r.owner)}/${enc(r.repo)}@${enc(r.ref)}/${enc(path)}`]) {
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) return res.text();
  }
  throw new Said(`<code>${esc(path)}</code> could not be fetched. Reloading asks again.`);
}

/** A link or an image's path, from the file it is in: the repo's path, or null where it leaves the repo. */
function resolve(from, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return null;
  const parts = target.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const p of target.replace(/^\//, '').split('/')) {
    if (p === '..') parts.pop(); else if (p && p !== '.') parts.push(p);
  }
  return parts.join('/');
}

/** A github.com link to a file or folder, read as this site's route. */
function fromGitHub(href) {
  const m = /^https?:\/\/(www\.)?github\.com(\/[^?#]*)?(#.*)?$/i.exec(href);
  if (!m || !m[2]) return null;
  const r = route(m[2]);
  return r && (m[2].split('/').filter(Boolean).length === 2 || /\/(blob|tree)\//.test(m[2])) ? m[2] + (m[3] ?? '') : null;
}

/** Each link in what was drawn kept in the site where it can be (a file, a folder, a github.com page); else as written. */
function relink(root, r, from, files) {
  for (const a of root.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (href.startsWith('#')) continue;
    const gh = fromGitHub(href);
    if (gh) { a.setAttribute('href', gh); continue; }
    const [target, hash = ''] = href.split('#');
    const path = resolve(from, decodeURIComponent(target));
    if (path === null) { a.target = '_blank'; a.rel = 'noopener'; continue; }
    const f = files.get(path);
    const kind = f?.type === 'tree' || path === '' ? 'tree' : 'blob';
    a.setAttribute('href', f || path === '' ? here(r, kind, path) + (hash ? `#${hash}` : '') : raw(r, path));
  }
}

/** A folder's README: the one GitHub would show. */
function readmeOf(files, dir) {
  const names = [...files.keys()].filter((p) => p.split('/').slice(0, -1).join('/') === dir && files.get(p).type === 'blob');
  return names.find((p) => /(^|\/)readme\.md$/i.test(p)) ?? names.find((p) => /(^|\/)readme(\.[a-z]+)?$/i.test(p)) ?? null;
}

/** A folder's entries as markdown, drawn by cards.md as any file is: its folders, then its files. */
function folderMarkdown(r, files, dir) {
  const inDir = [...files.entries()].filter(([p]) => p.split('/').slice(0, -1).join('/') === dir);
  const name = (p) => p.split('/').pop();
  const line = ([p, f]) => `- [${f.type === 'tree' ? '📁 ' : ''}${name(p).replace(/([\\[\]])/g, '\\$1')}](${enc(name(p))}${f.type === 'tree' ? '/' : ''})`;
  const folders = inDir.filter(([, f]) => f.type === 'tree').sort();
  const rest = inDir.filter(([, f]) => f.type === 'blob').sort();
  return `# ${dir ? dir.split('/').pop() : r.repo}\n\n${[...folders, ...rest].map(line).join('\n') || 'An empty folder.'}\n`;
}

/** Markdown drawn as cards, its links and images resolved against the file it came from. */
function cards(markdown, r, from, files) {
  const div = document.createElement('div');
  div.innerHTML = window.cardsmd.html(markdown, {
    images: (src) => { const p = r && resolve(from, src); return p == null ? src : raw(r, p); },
  });
  if (files) relink(div, r, from, files);
  return div;
}

function setCrumbs(r, kind, path) {
  const parts = path ? path.split('/') : [];
  const links = [`<a href="${here(r, 'tree', '')}">${esc(r.owner)}/${esc(r.repo)}</a>`];
  parts.forEach((p, i) => {
    const sub = parts.slice(0, i + 1).join('/');
    links.push(i === parts.length - 1 ? esc(p) : `<a href="${here(r, 'tree', sub)}">${esc(p)}</a>`);
  });
  crumbs.innerHTML = links.join(' / ');
  github.href = onGitHub(r, kind, path);
  github.hidden = false;
  document.title = `${path ? `${parts.at(-1)} · ` : ''}${r.owner}/${r.repo} · cards.md`;
}

const said = (html) => { const p = document.createElement('p'); p.className = 'said'; p.innerHTML = html; return p; };

async function showFile(r, files, path) {
  const f = files.get(path);
  if (!f) return [said(`There is no <code>${esc(path)}</code> in this repo. <a href="${here(r, 'tree', '')}">Its files</a>.`)];
  if (f.size > BIG) return [said(`<code>${esc(path)}</code> is ${(f.size / 1e6).toFixed(1)} MB, too big to draw here. <a href="${raw(r, path)}">The file itself</a>.`)];
  if (IMAGE.test(path)) { const img = new Image(); img.className = 'whole'; img.alt = path; img.src = raw(r, path); return [img]; }
  if (MARKDOWN.test(path)) {
    const md = await text(r, path);
    // Git LFS keeps a pointer here, the file itself elsewhere
    if (/^version https:\/\/git-lfs\.github\.com\/spec\//.test(md)) return [said(`<code>${esc(path)}</code> is kept in Git LFS. <a href="https://media.githubusercontent.com/media/${enc(r.owner)}/${enc(r.repo)}/${enc(r.ref)}/${enc(path)}">The file itself</a>.`)];
    return [cards(md, r, path, files)];
  }
  if (TEXT.test(path) || f.size < 200_000) {
    const pre = document.createElement('pre'); pre.className = 'text'; pre.textContent = await text(r, path); return [pre];
  }
  return [said(`<code>${esc(path)}</code> is not drawn here. <a href="${raw(r, path)}">The file itself</a>.`)];
}

async function showFolder(r, files, path) {
  if (path && files.get(path)?.type !== 'tree') return [said(`There is no folder <code>${esc(path)}</code> in this repo. <a href="${here(r, 'tree', '')}">Its files</a>.`)];
  // the entries' links are relative to the folder, as a README's are
  const out = [cards(folderMarkdown(r, files, path), r, path ? `${path}/` : '', files)];
  if (files.truncated) out.push(said('This repo has more files than GitHub lists at once; some are not shown.'));
  const readme = readmeOf(files, path);
  if (readme) out.push(...await showFile(r, files, readme));
  return out;
}

function front() {
  crumbs.textContent = '';
  github.hidden = true;
  document.title = 'cards.md';
  const intro = cards(`# Markdown, drawn as cards

Any public GitHub repo's markdown, drawn with [cards.md](https://github.com/proper-md/cards.md): its records, rows, tables, callouts and pictures as cards, its folders to browse. Change \`github.com\` in a link to this site's address, or paste one below.

- [sindresorhus/awesome](/sindresorhus/awesome)
- [jlevy/the-art-of-command-line](/jlevy/the-art-of-command-line)
`, null, '', null);
  const form = document.createElement('form');
  form.className = 'open';
  form.innerHTML = '<input name="url" placeholder="https://github.com/owner/repo" aria-label="A GitHub link"><button>Open</button>';
  form.onsubmit = (e) => {
    e.preventDefault();
    const v = form.url.value.trim().replace(/^https?:\/\/(www\.)?github\.com/i, '').replace(/^\/?/, '/');
    if (route(v)) go(v);
  };
  page.replaceChildren(intro, form);
}

async function show() {
  const r = route(location.pathname);
  if (!r) return front();
  setCrumbs(r, r.kind, r.path);
  page.replaceChildren(said('Fetching…'));
  try {
    const files = await listing(r);
    const nodes = r.kind === 'blob' ? await showFile(r, files, r.path) : await showFolder(r, files, r.path);
    page.replaceChildren(...nodes);
    if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
    else window.scrollTo(0, 0);
  } catch (err) {
    page.replaceChildren(said(err instanceof Said ? err.message : `Something went wrong: ${esc(err.message)}. Reloading tries again.`));
  }
}

function go(href) { history.pushState(null, '', href); show(); }

// a click on a link within the site moves without loading the page again
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
  e.preventDefault();
  go(url.pathname + url.hash);
});
window.addEventListener('popstate', show);
show();

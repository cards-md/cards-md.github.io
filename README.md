# cards-md.github.io

Any public GitHub repo's markdown, drawn as cards by
[cards.md](https://github.com/proper-md/cards.md), with its folders to
browse. To read a repo here, change `github.com` in its link to
`cards-md.github.io`:

```
https://github.com/owner/repo/blob/main/docs/guide.md
https://cards-md.github.io/owner/repo/blob/main/docs/guide.md
```

A folder shows its files and then its README, as GitHub does. Links to
other markdown in the repo stay on this site; images and other files
come from the repo itself.

## How it works

Everything happens in your browser. There is no server and nothing is
kept, except the file lists for this visit.

- **The file list** comes from one call per repo to GitHub's API. Without
  signing in, GitHub allows 60 of these an hour from each address; when
  that is spent, the list comes from jsDelivr instead.
- **A file's text** comes from `raw.githubusercontent.com`, which does not
  count against that limit, or else from jsDelivr.
- **The drawing** is cards.md's library, bundled for the browser
  (`vendor/cards.js`, `vendor/cards.css`).
- **The routes:** GitHub Pages serves `404.html` for any path it has no
  file for. That file is this page again, and `app.js` reads the path the
  way GitHub does.

Only public repos are drawn. Raw HTML inside markdown is shown as text,
never run: that is cards.md's rule.

## Working on it

```sh
tools/update.sh [path/to/cards.md]   # the bundle and style sheet, made again from a cards.md checkout
node tools/serve.js                  # the site on http://localhost:8080, 404.html for any other path, as Pages does
```

`vendor/cards.version` names the cards.md commit the bundle was made from.

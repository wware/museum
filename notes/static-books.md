# Notes: static books from the museum

**Status:** the build exists in `book/` (usage in `CLAUDE.md`, "Printed Editions"). `mass-spring.md` is the only chapter so far. CI builds the letter edition on `book-*` tags. Print figures and indexing are still open.

The idea: the museum argues that a live exhibit teaches better than a printed page, but a printed book is still worth having. Mark the interactive parts of each page, filter them out, and render what's left as a book. Any commit can become an edition, and any topic museum can produce books.

## Markers

```markdown
Book and web text

<!-- web -->
Demo text
<div id="mass-spring-sim"></div>
<!-- /web -->

<!-- print
![](mass-spring-k15.pdf)

Figure: mass-spring at k=15, f=0.4. The live version is at ...
-->
```

- A print block is one HTML comment, not a pair of marker comments. With `<!-- print -->` … `<!-- /print -->` the text in between would show on the website. As one comment, mkdocs hides it without a plugin.
- Web markers are comments too, so an unfiltered page renders cleanly in both mkdocs and pandoc.
- `assemble.py` walks each page line by line and ignores markers inside fenced code blocks. Unclosed, nested or stray markers stop the build with `file:line`.
- Every demo should have a print fallback, ideally a figure and caption. A gap where the demo was reads as unfinished. `mass-spring.md` has only a text pointer to the live exhibit for now.

## Where the toolchain came from

The LaTeX side is copied from `~/hack/books` (the Graphwright series) so the museum doesn't depend on that repo:

- `index-header.tex`, `index-footer.tex`, `index.ist`: the same, plus line wrapping for plain ``` blocks (from `k8s-hack/book/preamble.tex`).
- `make_cover_wrap.sh`: takes a `cover.yaml` path, reads `spine_width_inches` when no spine argument is given (the books version ignored that field), escapes text for pango, and uses a temp directory instead of fixed `/tmp` files.
- Lulu 6x9: 11pt, `openright`, margins top/bottom 0.75in, inner 0.875in, outer 0.625in, as in the books repo.
- Letter: the k8s-hack spiral-bound layout (two-sided, 1in inner margin for the coil), not the books repo's `openany` letter target. That target had pandoc write the PDF directly, so `makeindex` never ran. Here both trims go through the same `.tex` → xelatex/makeindex path, each in its own build directory.
- Conventions kept: `#` is a Part, `##` a Chapter, "Chapter N:" in the title, `\chaptermark` for the running header, code lines of 65 characters or fewer.

`assemble.py` produces a `text.md` in that format: it reads `book.yml`, filters each page, demotes headings (a page's `# Title` becomes `##`), numbers chapters, and makes relative image paths absolute. `book.yml` lives in the museum, so one museum could yield several books (a short introduction and a full reference) from the same pages.

### Going the other way

`books/scripts/split_for_mkdocs.py` turns a book's `text.md` into an mkdocs site, stripping `\index`, `\chaptermark` and `{=latex}` blocks. If LaTeX-only markup (index entries) ever goes on museum pages, it belongs inside print blocks: mkdocs would show `\index{...}`, or the inline `` `...`{=latex} `` form, as literal text.

## What has to stay pandoc-clean

Outside `web` blocks, book-bound pages can't use:

- Material-only syntax: `!!! note`, `=== "tab"`, `md_in_html`, `attr_list`. Avoid it, or translate it in the filter.
- Inline HTML styling, such as the gray "Demonstration Goal" box and control panels.

`assemble.py` warns about raw HTML outside web blocks and code lines over 65 characters. fvextra wraps long code lines, so the warning is about looks, not a broken build.

## Editions in CI

`.github/workflows/book.yml` builds the letter edition on a pushed `book-*` tag and attaches it to a Release. The 6x9 PDF and EPUB aren't in it yet.

- **Trigger:** a pushed tag matching `book-*`.
- **Job:** check out the tag, run `make -C book all letter`, attach the PDFs and EPUB to a GitHub Release for that tag.
- **Toolchain:** the index needs xelatex, so use a TeX Live image or apt packages (`pandoc texlive-xetex texlive-fonts-recommended texlive-latex-extra`, as in the books repo's `release.yml`). Typst and WeasyPrint won't fit.
- **Provenance:** the title page already says `git describe` and the commit date. In CI on a tag, that's the tag name.

Cutting an edition would be `git tag book-v1 && git push --tags`, and the Releases page becomes the archive of editions.

## The cover and page count

The spine width depends on the page count and paper type, so it comes from Lulu's calculator for the finished interior PDF: `make -C book cover SPINE=0.3`, or set `spine_width_inches` in `cover.yaml`. The cover needs a `book/cover-front.jpg`, which doesn't exist yet, and ImageMagick with pango, which isn't installed here, so the cover build is untested. Check Lulu's current guide for whether thick books also need a wider inner margin.

There's no automated Lulu preflight. A script could check trim size, fonts embedded, image resolution and page count limits against Lulu's published specs, but uploading to Lulu and checking their preview is still the final step.

## Several museums

- Separate the engine (mkdocs config, TypeScript exhibit framework, service worker, `book/`) from the content (`docs/`, `book.yml`).
- Exhibits useful in more than one topic, such as mass-spring, belong in a shared package that pages embed, to avoid copy-paste drift.

## Open questions

1. **Template repo or package** for the museum engine, once there's more than one museum? A template repo is easier to start with, and a package is better when engine fixes need to propagate.
2. **Print figures:** screenshots captured by Playwright (which the smoke tests already run), or hand-made SVGs? SVGs would need a conversion step to PDF (the books repo uses Inkscape).
3. **Index entries:** hand-placed as in the Graphwright books, or a first pass from a glossary as in `k8s-hack/book/add-index-markers.py`? Either way, inside print blocks.
4. **The cover image** and back-cover text in `book/cover.yaml` are placeholders.

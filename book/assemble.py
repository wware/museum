#!/usr/bin/env python3
"""
assemble.py -- Turn museum pages into one pandoc manuscript for the book.

Usage:
    python3 book/assemble.py [--book book/book.yml] [--docs docs] [--out book/build/text.md]

For each chapter listed in book.yml, in order:
  1. Drop <!-- web --> ... <!-- /web --> blocks (live demos, styled HTML).
  2. Unwrap <!-- print ... --> blocks (static figures, print-only text).
  3. Demote headings one level: a page's "# Title" becomes a "##" chapter,
     since "#" is a Part (pandoc --top-level-division=part).
  4. Make relative image paths absolute, so LaTeX finds them from build/.

Markers must be on lines of their own, and are ignored inside fenced code
blocks. Unbalanced or nested markers stop the build with file:line.

Warnings (not errors) go to stderr for raw HTML outside web blocks, which
pandoc would pass into the book, and for code lines over the 6x9 width.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

WEB_OPEN = "<!-- web -->"
WEB_CLOSE = "<!-- /web -->"
PRINT_OPEN = "<!-- print"
PRINT_CLOSE = "-->"

# About 65 monospace characters fit across a 6x9 page at 11pt
CODE_WIDTH = 65

FENCE = re.compile(r"^\s*(`{3,}|~{3,})")
CLOSING_FENCE = re.compile(r"^\s*(`{3,}|~{3,})\s*$")
HEADING = re.compile(r"^(#{1,5})(\s)")
IMAGE = re.compile(r"(!\[[^\]]*\]\()([^)\s]+)")
RAW_HTML = re.compile(r"^\s*<(?!!--)[a-zA-Z/]")


class MarkerError(Exception):
    pass


def filter_page(path: Path, warn) -> list[str]:
    """Return the page's book lines: web blocks dropped, print blocks unwrapped."""
    out = []
    block = None  # None, "web" or "print"
    block_line = 0
    fence = None  # the opening fence string while inside a code block

    for n, line in enumerate(path.read_text().splitlines(), 1):
        where = f"{path}:{n}"
        stripped = line.strip()

        if fence:
            m = CLOSING_FENCE.match(line)
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
            elif block != "web" and len(line) > CODE_WIDTH:
                warn(f"{where}: code line is {len(line)} characters (6x9 fits {CODE_WIDTH})")
            if block != "web":
                out.append(line)
            continue

        if stripped == WEB_OPEN or stripped == PRINT_OPEN:
            if block:
                raise MarkerError(f"{where}: {stripped} inside the {block} block opened at line {block_line}")
            block = "web" if stripped == WEB_OPEN else "print"
            block_line = n
            continue
        if stripped == WEB_CLOSE:
            if block != "web":
                raise MarkerError(f"{where}: {WEB_CLOSE} without an open web block")
            block = None
            continue
        if stripped == PRINT_CLOSE and block == "print":
            block = None
            continue
        if stripped.startswith(PRINT_OPEN) and stripped.endswith(PRINT_CLOSE):
            raise MarkerError(f"{where}: a print block is one comment: '<!-- print' and '-->' on lines of their own")
        if WEB_OPEN in line or WEB_CLOSE in line or stripped.startswith(PRINT_OPEN):
            raise MarkerError(f"{where}: book markers must be on a line of their own")

        m = FENCE.match(line)
        if m:
            fence = m.group(1)

        if block == "web":
            continue

        if not fence:
            if RAW_HTML.match(line):
                warn(f"{where}: raw HTML outside a web block will go into the book")
            line = HEADING.sub(r"#\1\2", line)
            line = IMAGE.sub(lambda m: m.group(1) + absolute(path, m.group(2)), line)
        out.append(line)

    if block:
        raise MarkerError(f"{path}:{block_line}: {block} block is never closed")
    if fence:
        raise MarkerError(f"{path}: code block opened with {fence} is never closed")
    return out


def absolute(page: Path, target: str) -> str:
    if re.match(r"^[a-z]+:", target) or target.startswith("/"):
        return target
    return str((page.parent / target).resolve())


def edition() -> str:
    """Describe the commit this book was built from, for the title page."""
    def git(*args):
        return subprocess.run(["git", *args], capture_output=True, text=True).stdout.strip()

    described = git("describe", "--tags", "--always", "--dirty")
    date = git("log", "-1", "--format=%cs")
    if not described:
        return "Untracked snapshot"
    return f"Edition {described}, {date}"


def yaml_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def assemble(book: dict, docs: Path, warn) -> str:
    stamp = edition()
    if book.get("live_url"):
        stamp += f". The live museum is at {book['live_url']}"
    meta = {k: book[k] for k in ("title", "subtitle", "author", "rights", "language", "description") if k in book}
    meta["date"] = stamp

    lines = ["---"]
    lines += [f"{k}: {yaml_string(str(v))}" for k, v in meta.items()]
    lines += ["...", ""]

    number = 0
    for part in book["parts"]:
        lines += [f"# {part['title']}", ""]
        for chapter in part["chapters"]:
            if isinstance(chapter, str):
                chapter = {"page": chapter}
            page = filter_page(docs / chapter["page"], warn)
            number += 1
            lines += chapter_lines(page, number, chapter, docs)
    return "\n".join(lines) + "\n"


def chapter_lines(page: list[str], number: int, chapter: dict, docs: Path) -> list[str]:
    """Number the chapter title and add its running header."""
    for i, line in enumerate(page):
        if line.startswith("## "):
            title = line[3:].strip()
            short = chapter.get("short", title)
            return page[:i] + [
                f"## Chapter {number}: {title}",
                "",
                f"`\\chaptermark{{{short}}}`{{=latex}}",
                "",
            ] + page[i + 1:] + [""]
    raise MarkerError(f"{docs / chapter['page']}: no '# Title' heading to make a chapter from")


def main() -> int:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--book", type=Path, default=here / "book.yml")
    parser.add_argument("--docs", type=Path, default=here.parent / "docs")
    parser.add_argument("--out", type=Path, default=here / "build" / "text.md")
    args = parser.parse_args()

    warnings = []

    def warn(message):
        warnings.append(message)
        print(f"warning: {message}", file=sys.stderr)

    book = yaml.safe_load(args.book.read_text())
    try:
        text = assemble(book, args.docs, warn)
    except MarkerError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text)
    print(f"Wrote {args.out} ({len(warnings)} warnings)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

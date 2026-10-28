# Build the printed editions of the museum.
#
#   make            6x9 PDF (Lulu) and EPUB
#   make 6x9        6x9 PDF only
#   make letter     8.5x11 PDF for spiral binding
#   make epub       EPUB only
#   make cover      6x9 cover wrap (SPINE=0.3 to override cover.yaml)
#   make clean
#
# Requires pandoc, xelatex and makeindex; the cover also needs ImageMagick.

PYTHON ?= python3
BUILD := build
TEXT := $(BUILD)/text.md
DOCS := ../docs
PAGES := $(shell find $(DOCS) -name '*.md')
BIB := $(wildcard references.bib)

# Lulu 6x9: wide inner margin for the binding, chapters on right-hand pages
GEOMETRY_6x9 := paperwidth=6in,paperheight=9in,top=0.75in,bottom=0.75in,inner=0.875in,outer=0.625in
CLASS_6x9 := openright

# Letter, spiral bound and printed two-sided: the inner margin leaves room
# for the coil
GEOMETRY_letter := paperwidth=8.5in,paperheight=11in,top=0.75in,bottom=0.75in,inner=1in,outer=0.75in,twoside
CLASS_letter := openright

PANDOC_PDF = pandoc $(TEXT) \
	-f markdown+raw_tex \
	--top-level-division=part \
	--toc \
	-V documentclass=book \
	-V fontsize=11pt \
	-V classoption=$(CLASS_$*) \
	-V geometry:"$(GEOMETRY_$*)" \
	--include-in-header=index-header.tex \
	--include-after-body=index-footer.tex \
	$(if $(BIB),--citeproc --bibliography=$(BIB))

.PHONY: all 6x9 letter epub cover clean

all: 6x9 epub

6x9: $(BUILD)/museum-6x9.pdf
letter: $(BUILD)/museum-letter.pdf
epub: $(BUILD)/museum.epub

$(TEXT): book.yml assemble.py $(PAGES)
	$(PYTHON) assemble.py --book book.yml --docs $(DOCS) --out $@

# Each trim size builds in its own directory so the LaTeX auxiliary files
# don't collide. makeindex runs between passes for both.
$(BUILD)/museum-%.pdf: $(TEXT) index-header.tex index-footer.tex index.ist $(BIB)
	mkdir -p $(BUILD)/$*
	$(PANDOC_PDF) -o $(BUILD)/$*/book.tex
	cd $(BUILD)/$* && xelatex -interaction=nonstopmode -halt-on-error book.tex
	cd $(BUILD)/$* && makeindex -s ../../index.ist book
	cd $(BUILD)/$* && xelatex -interaction=nonstopmode -halt-on-error book.tex
	cd $(BUILD)/$* && xelatex -interaction=nonstopmode -halt-on-error book.tex
	cp $(BUILD)/$*/book.pdf $@

$(BUILD)/museum.epub: $(TEXT) $(BIB)
	pandoc $(TEXT) -o $@ $(if $(BIB),--citeproc --bibliography=$(BIB))

cover: cover.yaml
	./make_cover_wrap.sh cover.yaml "$(SPINE)" $(BUILD)/cover-wrap.jpg

clean:
	rm -rf $(BUILD)

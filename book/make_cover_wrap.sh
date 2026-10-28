#!/bin/bash
# make_cover_wrap.sh -- build a full cover wrap (back | spine | front) for
# the 6x9 edition
#
# Usage: ./make_cover_wrap.sh <cover.yaml> [spine_width_inches] [output_file]
#
# The spine width depends on the page count and paper, so take it from
# Lulu's calculator for the finished interior PDF. Without the argument,
# spine_width_inches from cover.yaml is used.
#
# Example:
#   ./make_cover_wrap.sh cover.yaml 0.3 build/cover-wrap.jpg
#
# Requirements: ImageMagick (convert, with pango), bc, python3 with PyYAML

set -e

YAML="${1:?Usage: $0 <cover.yaml> [spine_width_inches] [output_file]}"
if [ ! -f "$YAML" ]; then
    echo "Error: $YAML not found" >&2
    exit 1
fi
COVER_DIR="$(cd "$(dirname "$YAML")" && pwd)"

# Print one field of cover.yaml; with "markup", escape it for pango
_yaml() {
    python3 -c '
import sys, yaml
from xml.sax.saxutils import escape
with open(sys.argv[1]) as f:
    d = yaml.safe_load(f)
v = str(d.get(sys.argv[2], ""))
print(escape(v) if len(sys.argv) > 3 else v)
' "$YAML" "$@"
}

SPINE_INCHES="${2:-$(_yaml spine_width_inches)}"
if [ -z "$SPINE_INCHES" ]; then
    echo "Error: no spine width given and none in $YAML" >&2
    exit 1
fi
OUTPUT="${3:-${COVER_DIR}/build/cover-wrap.jpg}"
mkdir -p "$(dirname "$OUTPUT")"

SPINE_TEXT="$(_yaml spine_text)"
FRONT="${COVER_DIR}/$(_yaml front_image)"
if [ ! -f "$FRONT" ]; then
    echo "Error: front cover image $FRONT not found" >&2
    exit 1
fi
BACK_TEXT="$(_yaml back_text markup)"
TITLE_COLOR="$(_yaml title_color)"
CROP_MODE="$(_yaml front_image_crop)"
CROP_X_SOURCE="$(_yaml front_image_crop_x_source)"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

DPI=300
HEIGHT=2700          # 9 inches * 300 DPI
COVER_W=1800         # 6 inches * 300 DPI
SPINE_W=$(echo "$SPINE_INCHES * $DPI" | bc | xargs printf "%.0f")
TOTAL_W=$(( COVER_W + SPINE_W + COVER_W ))

DARK_BLUE="#1a2a4a"
WHITE="#ffffff"
FONT="DejaVu-Sans-Bold"

# --- Back cover ---
BACK_FONT_SIZE=36
BACK_MARGIN=150
BACK_TEXT_W=$(( COVER_W - BACK_MARGIN * 2 ))
BACK_Y=$(( HEIGHT * 2 / 5 ))

convert \
    -size "${BACK_TEXT_W}x" \
    -background "${DARK_BLUE}" \
    pango:"<span font='DejaVu Sans Bold ${BACK_FONT_SIZE}' foreground='${WHITE}'>${BACK_TEXT}</span>" \
    "$TMP"/back_text.png

TEXT_H=$(identify -format "%h" "$TMP"/back_text.png)
COMPOSITE_Y=$(( BACK_Y - TEXT_H / 2 ))
if [ "${COMPOSITE_Y}" -lt "${BACK_MARGIN}" ]; then
    COMPOSITE_Y=${BACK_MARGIN}
fi

convert \
    -size "${COVER_W}x${HEIGHT}" xc:"${DARK_BLUE}" \
    "$TMP"/back_text.png \
    -geometry "+${BACK_MARGIN}+${COMPOSITE_Y}" \
    -composite \
    "$TMP"/back_cover.png

# --- Spine ---
SPINE_FONT_SIZE=60

convert \
    -size "${HEIGHT}x${SPINE_W}" xc:"${DARK_BLUE}" \
    -fill "${WHITE}" \
    -font "${FONT}" \
    -pointsize "${SPINE_FONT_SIZE}" \
    -gravity Center \
    -annotate 0 "${SPINE_TEXT}" \
    -rotate 90 \
    "$TMP"/spine.png

# --- Front cover ---
if [ "$CROP_MODE" = "custom" ] && [ -n "$CROP_X_SOURCE" ]; then
    # Custom crop: center a specific x coordinate from the source image
    SRC_H=$(identify -format "%h" "${FRONT}")
    SCALE=$(echo "scale=6; $HEIGHT / $SRC_H" | bc)
    SRC_MID_SCALED=$(echo "scale=0; $CROP_X_SOURCE * $SCALE / 1" | bc)
    CROP_X=$(( SRC_MID_SCALED - COVER_W / 2 ))
    if [ "$CROP_X" -lt 0 ]; then CROP_X=0; fi
    SCALED_W=$(echo "scale=0; $(identify -format "%w" "${FRONT}") * $HEIGHT / $SRC_H" | bc)
    convert \
        "${FRONT}" \
        -resize "x${HEIGHT}" \
        -gravity NorthWest \
        -extent "${SCALED_W}x${HEIGHT}" \
        -crop "${COVER_W}x${HEIGHT}+${CROP_X}+0" +repage \
        "$TMP"/front_cover_base.png
else
    # Default: scale to fill, center crop
    convert \
        "${FRONT}" \
        -resize "${COVER_W}x${HEIGHT}^" \
        -gravity Center \
        -extent "${COVER_W}x${HEIGHT}" \
        "$TMP"/front_cover_base.png
fi

# --- Title overlay ---
TITLE_TEXT="$(_yaml title markup)"
TITLE_FONT_SIZE=80
TITLE_MARGIN=120
TITLE_TEXT_W=$(( COVER_W - TITLE_MARGIN * 2 ))

convert \
    -size "${TITLE_TEXT_W}x" \
    -background none \
    pango:"<span font='DejaVu Sans Bold ${TITLE_FONT_SIZE}' foreground='${TITLE_COLOR}'>${TITLE_TEXT}</span>" \
    "$TMP"/front_title.png

TITLE_H=$(identify -format "%h" "$TMP"/front_title.png)
TITLE_Y=$(( TITLE_MARGIN + TITLE_H ))

# --- Author name at bottom ---
AUTHOR_TEXT="$(_yaml author markup)"
convert \
    -size "${TITLE_TEXT_W}x" \
    -background none \
    pango:"<span font='DejaVu Sans Bold 60' foreground='${TITLE_COLOR}'>${AUTHOR_TEXT}</span>" \
    "$TMP"/front_author.png

AUTHOR_H=$(identify -format "%h" "$TMP"/front_author.png)
AUTHOR_Y=$(( HEIGHT - TITLE_MARGIN - AUTHOR_H ))

convert \
    "$TMP"/front_cover_base.png \
    "$TMP"/front_title.png \
    -geometry "+${TITLE_MARGIN}+${TITLE_Y}" \
    -composite \
    "$TMP"/front_author.png \
    -geometry "+${TITLE_MARGIN}+${AUTHOR_Y}" \
    -composite \
    "$TMP"/front_cover.png

# --- Assemble wrap: back | spine | front ---
convert \
    "$TMP"/back_cover.png \
    "$TMP"/spine.png \
    "$TMP"/front_cover.png \
    +append \
    -density "${DPI}" \
    "${OUTPUT}"

echo "Written: ${OUTPUT}  (${TOTAL_W}x${HEIGHT} px, spine ${SPINE_W}px / ${SPINE_INCHES}\")"

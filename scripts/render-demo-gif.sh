#!/bin/sh
set -eu

output_path=${1:-assets/driftwatch-demo.gif}
ffmpeg_bin=${FFMPEG_BIN:-/opt/homebrew/bin/ffmpeg}

if [ ! -x "$ffmpeg_bin" ]; then
  printf 'ffmpeg not found at %s\n' "$ffmpeg_bin" >&2
  exit 1
fi

/bin/mkdir -p "$(/usr/bin/dirname "$output_path")"
subtitle_file=$(/usr/bin/mktemp /tmp/driftwatch-demo.XXXXXX.ass)
trap '/bin/rm -f "$subtitle_file"' EXIT

/bin/cat >"$subtitle_file" <<'ASS'
[Script Info]
ScriptType: v4.00+
PlayResX: 1200
PlayResY: 720
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Mono,Menlo,27,&H00E6EDF3,&H00E6EDF3,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Muted,Menlo,22,&H008B949E,&H008B949E,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Title,Menlo,25,&H00C9D1D9,&H00C9D1D9,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Red,Menlo,24,&H006B7CFF,&H006B7CFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Yellow,Menlo,24,&H0056D4D2,&H0056D4D2,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: Green,Menlo,24,&H007EE787,&H007EE787,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:07.00,Mono,,0,0,0,,{\p1\an7\pos(38,34)\1c&H00201811&}m 0 0 l 1124 0 l 1124 650 l 0 650{\p0}
Dialogue: 1,0:00:00.00,0:00:07.00,Mono,,0,0,0,,{\p1\an7\pos(38,34)\1c&H002B2118&}m 0 0 l 1124 0 l 1124 56 l 0 56{\p0}
Dialogue: 2,0:00:00.00,0:00:07.00,Red,,0,0,0,,{\an7\pos(68,49)}●
Dialogue: 2,0:00:00.00,0:00:07.00,Yellow,,0,0,0,,{\an7\pos(94,49)}●
Dialogue: 2,0:00:00.00,0:00:07.00,Green,,0,0,0,,{\an7\pos(120,49)}●
Dialogue: 2,0:00:00.00,0:00:07.00,Title,,0,0,0,,{\an7\pos(456,50)}driftwatch / demo
Dialogue: 2,0:00:00.15,0:00:07.00,Green,,0,0,0,,{\fad(120,0)\an7\pos(72,118)}$
Dialogue: 2,0:00:00.15,0:00:07.00,Mono,,0,0,0,,{\fad(120,0)\an7\pos(100,118)}npx driftwatch report
Dialogue: 2,0:00:00.70,0:00:07.00,Title,,0,0,0,,{\fad(150,0)\an7\pos(72,168)}DRIFTWATCH REPORT
Dialogue: 2,0:00:01.00,0:00:07.00,Muted,,0,0,0,,{\fad(150,0)\an7\pos(72,207)}commit 5e0b668  •  6 claims verified
Dialogue: 2,0:00:01.35,0:00:07.00,Red,,0,0,0,,{\fad(150,0)\an7\pos(72,252)}3 VIOLATED
Dialogue: 2,0:00:01.35,0:00:07.00,Yellow,,0,0,0,,{\fad(150,0)\an7\pos(286,252)}0 UNIMPLEMENTED
Dialogue: 2,0:00:01.35,0:00:07.00,Green,,0,0,0,,{\fad(150,0)\an7\pos(590,252)}3 SATISFIED
Dialogue: 2,0:00:01.90,0:00:07.00,Red,,0,0,0,,{\fad(150,0)\an7\pos(72,306)}[!] SESSION_TTL_MINUTES
Dialogue: 2,0:00:02.15,0:00:07.00,Muted,,0,0,0,,{\fad(150,0)\an7\pos(110,342)}required 30  •  found 60  •  demo/src/service.ts:8
Dialogue: 2,0:00:02.65,0:00:07.00,Red,,0,0,0,,{\fad(150,0)\an7\pos(72,388)}[!] RATE_LIMIT_REQUESTS_PER_MINUTE
Dialogue: 2,0:00:02.90,0:00:07.00,Muted,,0,0,0,,{\fad(150,0)\an7\pos(110,424)}required 100  •  found 1,000  •  demo/src/service.ts:10
Dialogue: 2,0:00:03.40,0:00:07.00,Red,,0,0,0,,{\fad(150,0)\an7\pos(72,470)}[!] LOGIN_AUDIT_FIELDS
Dialogue: 2,0:00:03.65,0:00:07.00,Muted,,0,0,0,,{\fad(150,0)\an7\pos(110,506)}missing timestamp  •  demo/src/service.ts:12
Dialogue: 2,0:00:04.35,0:00:07.00,Green,,0,0,0,,{\fad(150,0)\an7\pos(72,558)}[ok] health  •  missing-user status  •  admin header
Dialogue: 2,0:00:05.05,0:00:07.00,Muted,,0,0,0,,{\fad(150,0)\an7\pos(72,614)}wrote .driftwatch/DRIFT.md  •  exit 1
ASS

"$ffmpeg_bin" -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=0x0b0f14:s=1200x720:r=12:d=7" \
  -filter_complex "[0:v]ass=$subtitle_file,split[rendered][palette_source];[palette_source]palettegen=max_colors=128[palette];[rendered][palette]paletteuse=dither=bayer:bayer_scale=3" \
  -loop 0 "$output_path"

printf 'wrote %s\n' "$output_path"

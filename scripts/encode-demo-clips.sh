#!/bin/zsh
# Transcode the MailPilot demo recordings to universally-playable H.264 + AAC.
#
# Two reasons this step exists:
#   1. the shipped .mp4s are HEVC (hvc1), which Chrome and Firefox will not play
#      on most machines;
#   2. we re-encode from the .mov masters (h264 @ ~5.3 Mbps) rather than from the
#      541 kbps HEVC files, so the 1600px output is not built on an already
#      crushed source.
#
# KEEP THE AUDIO. The demos carry a narration track (Stream #0:1, aac stereo).
# Do NOT pass -an.
set -e
cd /Users/wukun/Documents/tmp/mailAutopilotForFS/deck/_html-source/assets/clips
D=/Users/wukun/Downloads

enc() {
  echo "=== start $3"
  /usr/local/bin/ffmpeg -nostdin -y -v error -i "$1" \
    -vf "fps=30,scale=1600:-2:flags=lanczos" \
    -c:v libx264 -profile:v high -level 4.1 -preset veryfast -crf 23 \
    -pix_fmt yuv420p \
    -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart "$3"
  echo "=== done  $3  $(du -h "$3" | cut -f1)"
}

enc "$D/MailPilotForBank_en_1_Identity-Assurance.mov" . demo-1-identity.mp4
enc "$D/MailPilotForBank_en_2_Dispute-Handling.mov"   . demo-2-dispute.mp4
enc "$D/MailPilotForBank_en_3_Fraud-Defense.mov"      . demo-3-fraud.mp4
enc "$D/MailPilotForBank_en_4_Admin.mov"              . demo-4-admin.mp4

echo "=== ALL DONE ==="
for f in demo-*.mp4; do
  printf "%-24s %6s  audio=%s\n" "$f" "$(du -h "$f" | cut -f1)" \
    "$(/usr/local/bin/ffmpeg -i "$f" 2>&1 | grep -c 'Audio: ')"
done

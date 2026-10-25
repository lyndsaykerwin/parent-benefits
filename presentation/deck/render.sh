#!/bin/zsh
# Renders bundle-deck.html to PDF and one PNG per slide (headless Chrome).
D=/Users/lyndsay/Documents/hackathon/presentation/deck
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf=$D/bundle-deck.pdf file://$D/bundle-deck.html 2>/dev/null
N=$(grep -c '<section class="slide' $D/bundle-deck.html)
for i in $(seq 1 $N); do
  "$C" --headless --disable-gpu --hide-scrollbars --window-size=1920,1080 --virtual-time-budget=8000 --screenshot=$D/slides/slide-$(printf %02d $i).png "file://$D/bundle-deck.html?s=$i" 2>/dev/null
done
ls -la $D/slides $D/bundle-deck.pdf

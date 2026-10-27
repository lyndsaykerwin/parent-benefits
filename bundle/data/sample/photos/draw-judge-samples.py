# Draws two sample photos for judges (Oct 26 2026). Made-up images, no people, addresses or card numbers.
#  1. A car-seat label for a model on NHTSA's public recall list (Britax Advocate 70 G3, model E9LJ91A, NHTSA recall 12C004000),
#     so the recall check finds a real recall. The label itself is drawn, not photographed, and says so.
#  2. A made-up store receipt with FSA/HSA-eligible baby items mixed with everyday ones, so the money-back check has something to find.
# Usage: python3 draw-judge-samples.py <output folder>
import sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]
F = '/System/Library/Fonts/Supplemental/'
def font(name, size): return ImageFont.truetype(F + name, size)
B = lambda s: font('Arial Bold.ttf', s); R = lambda s: font('Arial.ttf', s); N = lambda s: font('Arial Narrow Bold.ttf', s)
MONO = lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/Courier New Bold.ttf', s)

def texture(d, W, H, bg, n, seed):
    random.seed(seed)
    for _ in range(n):
        x, y = random.randrange(W), random.randrange(H); c = random.randint(-10, 10)
        d.point((x, y), fill=tuple(max(0, min(255, v + c)) for v in bg))

def car_seat_label(path):
    W, H, bg = 1200, 900, (44, 46, 52)
    img = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(img); texture(d, W, H, bg, 9000, 3)
    sx, sy, sw, sh = 110, 80, 980, 740
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(shadow).rounded_rectangle((sx + 10, sy + 14, sx + sw + 10, sy + sh + 14), 22, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10)); img.paste(shadow, (0, 0), shadow); d = ImageDraw.Draw(img)
    d.rounded_rectangle((sx, sy, sx + sw, sy + sh), 22, fill=(252, 252, 249), outline=(205, 205, 200), width=3)
    d.rectangle((sx, sy + 26, sx + sw, sy + 84), fill=(30, 30, 30))
    d.text((sx + sw / 2, sy + 55), 'SAMPLE IMAGE - DRAWN LABEL FOR JUDGES', font=B(30), fill=(255, 255, 255), anchor='mm')
    y = sy + 118
    d.text((sx + 50, y), 'BRITAX', font=font('Arial Black.ttf', 58), fill=(20, 20, 20)); y += 80
    d.text((sx + 50, y), 'Advocate 70 G3  |  Convertible Car Seat', font=R(38), fill=(40, 40, 40)); y += 62
    d.line((sx + 50, y + 8, sx + sw - 50, y + 8), fill=(60, 60, 60), width=3); y += 30
    for k, v in [('Model No.:', 'E9LJ91A'), ('Date of Manufacture:', '2012/03/15'), ('Lot No.:', '120315-B')]:
        d.text((sx + 50, y), k, font=B(40), fill=(25, 25, 25)); d.text((sx + 470, y), v, font=B(44), fill=(0, 0, 0)); y += 66
    d.line((sx + 50, y + 8, sx + sw - 50, y + 8), fill=(60, 60, 60), width=3); y += 30
    d.text((sx + 50, y), 'Rear-facing 5-40 lb. Forward-facing 20-70 lb.', font=R(26), fill=(70, 70, 70)); y += 38
    d.text((sx + 50, y), 'Model on NHTSA recall 12C004000 (public record). Label drawn for testing.', font=R(26), fill=(70, 70, 70))
    d.rectangle((sx + 50, sy + sh - 92, sx + sw - 50, sy + sh - 40), outline=(200, 40, 30), width=3)
    d.text((sx + sw / 2, sy + sh - 66), 'SAMPLE FOR TESTING  -  NOT A PHOTO OF A REAL SEAT', font=N(28), fill=(200, 40, 30), anchor='mm')
    img.save(path, optimize=True)

def receipt(path):
    W, H, bg = 1000, 1500, (205, 200, 192)
    img = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(img); texture(d, W, H, bg, 6000, 5)
    px, py, pw, ph = 170, 60, 660, 1380
    d.rectangle((px, py, px + pw, py + ph), fill=(250, 249, 245))
    y = py + 40; c = px + pw / 2
    for t, f in [('MAPLE & MOON BABY', MONO(40)), ('(made-up store, sample receipt)', MONO(22)), ('Store #0000  Sample City, MA', MONO(24)), ('10/20/2026  2:14 PM', MONO(24))]:
        d.text((c, y), t, font=f, fill=(25, 25, 25), anchor='mt'); y += 46
    y += 20; d.text((px + 30, y), '-' * 38, font=MONO(24), fill=(60, 60, 60)); y += 40
    items = [('FRIDABABY 3-IN-1 THERMOMETER', '29.99'), ('NOSEFRIDA NASAL ASPIRATOR', '17.99'), ('LITTLE REMEDIES GAS DROPS', '9.49'),
             ('SALINE NASAL DROPS 1OZ', '5.99'), ('PAMPERS SWADDLERS SZ1 84CT', '31.49'), ('CARTERS ONESIES 5PK', '22.00'), ('BURP CLOTHS 3PK', '12.99')]
    for name, price in items:
        d.text((px + 30, y), name, font=MONO(24), fill=(20, 20, 20)); d.text((px + pw - 30, y), price, font=MONO(24), fill=(20, 20, 20), anchor='ra'); y += 44
    total = sum(float(p) for _, p in items); tax = round((22.00 + 12.99) * 0.0625, 2)
    y += 10; d.text((px + 30, y), '-' * 38, font=MONO(24), fill=(60, 60, 60)); y += 40
    for k, v in [('SUBTOTAL', f'{total:.2f}'), ('TAX', f'{tax:.2f}'), ('TOTAL', f'{total + tax:.2f}')]:
        d.text((px + 30, y), k, font=MONO(28), fill=(20, 20, 20)); d.text((px + pw - 30, y), v, font=MONO(28), fill=(20, 20, 20), anchor='ra'); y += 48
    y += 30
    for t in ['PAID: SAMPLE CARD ****0000', 'THANK YOU', 'SAMPLE RECEIPT FOR TESTING ONLY']:
        d.text((c, y), t, font=MONO(24), fill=(40, 40, 40), anchor='mt'); y += 42
    img.save(path, optimize=True)

car_seat_label(f'{OUT}/item-britax-recall-sample-label.png')
receipt(f'{OUT}/receipt-maple-moon-sample.png')
print('ok')

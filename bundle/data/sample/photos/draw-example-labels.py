# Draws two made-up product labels (no real brands, no people) for the Bundle scan sheet examples.
import sys, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]
F = '/System/Library/Fonts/Supplemental/'
def font(name, size): return ImageFont.truetype(F + name, size)
B = lambda s: font('Arial Bold.ttf', s); R = lambda s: font('Arial.ttf', s); N = lambda s: font('Arial Narrow Bold.ttf', s)

def label(path, bg, lines, warn):
    W, H = 1200, 860
    img = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(img)
    random.seed(7)
    for _ in range(9000):  # plastic texture
        x, y = random.randrange(W), random.randrange(H); c = random.randint(-10, 10)
        d.point((x, y), fill=tuple(max(0, min(255, v + c)) for v in bg))
    sx, sy, sw, sh = 110, 90, 980, 680
    sh_img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh_img)
    sd.rounded_rectangle((sx + 10, sy + 14, sx + sw + 10, sy + sh + 14), 22, fill=(0, 0, 0, 90))
    img.paste(sh_img.filter(ImageFilter.GaussianBlur(10)), (0, 0), sh_img.filter(ImageFilter.GaussianBlur(10)))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((sx, sy, sx + sw, sy + sh), 22, fill=(252, 252, 249), outline=(205, 205, 200), width=3)
    d.rectangle((sx, sy + 26, sx + sw, sy + 84), fill=(30, 30, 30))
    d.text((sx + sw / 2, sy + 55), 'SAMPLE IMAGE - MADE-UP LABEL FOR PRACTICE', font=B(30), fill=(255, 255, 255), anchor='mm')
    y = sy + 120
    for kind, text in lines:
        if kind == 'brand': d.text((sx + 50, y), text, font=font('Arial Black.ttf', 54), fill=(20, 20, 20)); y += 76
        elif kind == 'name': d.text((sx + 50, y), text, font=R(38), fill=(40, 40, 40)); y += 62
        elif kind == 'rule': d.line((sx + 50, y + 8, sx + sw - 50, y + 8), fill=(60, 60, 60), width=3); y += 30
        elif kind == 'field':
            k, v = text
            d.text((sx + 50, y), k, font=B(40), fill=(25, 25, 25))
            d.text((sx + 470, y), v, font=font('Arial Bold.ttf', 44), fill=(0, 0, 0)); y += 66
        elif kind == 'small': d.text((sx + 50, y), text, font=R(26), fill=(70, 70, 70)); y += 38
    d.rectangle((sx + 50, sy + sh - 92, sx + sw - 50, sy + sh - 40), outline=(200, 40, 30), width=3)
    d.text((sx + sw / 2, sy + sh - 66), warn, font=N(28), fill=(200, 40, 30), anchor='mm')
    img.save(path, optimize=True)

label(f'{OUT}/item-example-car-seat-label.png', (58, 60, 66), [
    ('brand', 'ZOOBLEFERN'), ('name', 'Made-up brand  |  Infant Car Seat'), ('rule', ''),
    ('field', ('Model No.:', 'ZF-CS100')), ('field', ('Date of Manufacture:', '2026/02/09')), ('field', ('Lot No.:', 'CS0209B')), ('rule', ''),
    ('small', 'For use with children 4-35 lb and up to 32 in. (made-up example text)'),
], 'NOT A REAL PRODUCT  -  FOR PRACTICE ONLY')
label(f'{OUT}/item-example-stroller-label.png', (112, 116, 122), [
    ('brand', 'TRUNDLEMOTH'), ('name', 'Made-up brand  |  City Stroller'), ('rule', ''),
    ('field', ('Model No.:', 'TM-ST200')), ('field', ('Date of Manufacture:', '2026/03/14')), ('field', ('Lot:', '0314A')), ('rule', ''),
    ('small', 'Maximum child weight 50 lb. (made-up example text)'),
], 'NOT A REAL PRODUCT  -  FOR PRACTICE ONLY')
print('ok')

from PIL import Image, ImageDraw, ImageFont
import sys
S = 4096  # supersampled, reduced to 1024
INK, GOLD = (0x14, 0x16, 0x1C), (0xD4, 0xA6, 0x57)
img = Image.new('RGB', (S, S), INK)
d = ImageDraw.Draw(img)
font = ImageFont.truetype('assets/fonts/Newsreader-Medium.ttf', int(S * 0.74))
l, t, r, b = d.textbbox((0, 0), 'Z', font=font)
x = (S - (r - l)) / 2 - l
y = (S - (b - t)) / 2 - t - S * 0.035
d.text((x, y), 'Z', font=font, fill=GOLD)
# A short rule under the letter: the "ground line" the brand moves along.
w, h = S * 0.20, S * 0.014
cy = y + b + S * 0.075
d.rounded_rectangle([(S - w) / 2, cy, (S + w) / 2, cy + h], radius=h / 2, fill=GOLD)
img.resize((1024, 1024), Image.LANCZOS).save(sys.argv[1])

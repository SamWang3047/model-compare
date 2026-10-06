"""Generate the site's social card. Pillow is only needed to regenerate this asset."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent.parent
image = Image.new('RGB', (1200, 630), '#f1f6fd')
draw = ImageDraw.Draw(image)
font_path = Path('C:/Windows/Fonts/segoeui.ttf')
bold_path = Path('C:/Windows/Fonts/segoeuib.ttf')
def font(size, bold=False):
    selected = bold_path if bold else font_path
    return ImageFont.truetype(str(selected), size) if selected.exists() else ImageFont.load_default()
draw.rounded_rectangle((72, 62, 128, 118), radius=14, fill='#165dcc')
for x, top in [(87, 89), (101, 78), (115, 84)]:
    draw.line((x, top, x, 103), fill='white', width=6)
draw.text((148, 63), 'modelcompare', font=font(36, True), fill='#17243a')
draw.text((76, 195), 'AI models.', font=font(92, True), fill='#17243a')
draw.text((76, 305), 'Coding first.', font=font(92, True), fill='#165dcc')
draw.text((80, 467), 'Price. Performance. Harnesses.', font=font(32), fill='#53647b')
draw.line((80, 552, 1120, 552), fill='#dce5ef', width=2)
draw.text((80, 568), 'An interactive, sourced research report', font=font(20), fill='#53647b')
image.save(root / 'og.png', optimize=True)

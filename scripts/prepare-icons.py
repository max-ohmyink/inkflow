"""Prepare native branding by adapting the official Oh My Ink logo symbol."""
from pathlib import Path
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
logo = Image.open(root / 'assets/brand/ohmyink-logo.png').convert('RGBA')
symbol = logo.crop((0, 0, 78, logo.height))
symbol = symbol.crop(symbol.getbbox())
fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
mark = ImageOps.contain(symbol, (560, 650), Image.Resampling.LANCZOS)
fg.alpha_composite(mark, ((1024-mark.width)//2, (1024-mark.height)//2))
bg = Image.new('RGBA', (1024, 1024), '#0D0D0D')
icon = Image.alpha_composite(bg, fg).convert('RGB')
out = root / 'assets/images'
icon.save(out / 'icon.png')
fg.save(out / 'splash-icon.png')
fg.save(out / 'android-icon-foreground.png')
bg.convert('RGB').save(out / 'android-icon-background.png')
mono = Image.new('RGBA', (1024, 1024), 'white')
mono.putalpha(fg.getchannel('A'))
mono.save(out / 'android-icon-monochrome.png')
icon.resize((64, 64), Image.Resampling.LANCZOS).save(out / 'favicon.png')
print('Prepared 6 native brand assets from the official logo symbol.')

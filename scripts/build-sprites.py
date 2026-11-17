"""Turns the generated concept renders in assets-src/gen into game sprites in public/sprites.

  python3 scripts/build-sprites.py

Characters become a 4-frame strip (front step A/B, back step A/B) plus a head-and-shoulders
portrait; enemies a 2-frame strip; loot and props a single trimmed image.
"""
from PIL import Image, ImageEnhance
import os

SRC = 'assets-src/gen'
OUT = 'public/sprites'
SS = 3  # supersample, then shrink once for clean edges


def load(name):
    im = Image.open(f'{SRC}/{name}.png').convert('RGBA')
    a = im.getchannel('A').point(lambda v: 0 if v < 24 else v)
    im.putalpha(a)
    return im.crop(im.getbbox())


def fit(im, w, h):
    k = min(w / im.width, h / im.height)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def cell(im, size, pad=4, angle=0.0, lift=0, sx=1.0, sy=1.0, height=None):
    """Stand the figure on the bottom of a square cell; optional lean, hop and squash."""
    big = size * SS
    fig = fit(im, big - pad * 2 * SS, (height or (size - pad * 2)) * SS)
    if sx != 1 or sy != 1:
        fig = fig.resize((round(fig.width * sx), round(fig.height * sy)), Image.LANCZOS)
    cv = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    foot = big - pad * SS
    cv.alpha_composite(fig, ((big - fig.width) // 2, foot - fig.height - lift * SS))
    if angle:
        cv = cv.rotate(angle, resample=Image.BICUBIC, center=(big / 2, foot))
    return cv.resize((size, size), Image.LANCZOS)


def strip(frames):
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * w, 0))
    return out


def save(im, name):
    im.save(f'{OUT}/{name}.png', optimize=True)
    print(f'{name}.png', im.size, os.path.getsize(f'{OUT}/{name}.png') // 1024, 'KB')


os.makedirs(OUT, exist_ok=True)

for key in ['cust_hunter', 'cust_collector', 'cust_rusher', 'ped_a', 'ped_b']:
    front, back = load(key), load(key + '_back')
    frames = []
    for im in (front, back):
        frames += [cell(im, 128, angle=4, lift=0), cell(im, 128, angle=-4, lift=3)]
    save(strip(frames), key)
    # portrait: the head and shoulders, square
    side = round(front.height * 0.56)
    left = max(0, (front.width - side) // 2)
    save(front.crop((left, 0, left + side, side)).resize((160, 160), Image.LANCZOS), key + '_face')

save(strip([cell(load('bot'), 128, angle=3), cell(load('bot'), 128, angle=-3, lift=2)]), 'bot')
save(strip([cell(load('drone'), 128, pad=8, angle=3), cell(load('drone'), 128, pad=8, angle=-3, lift=3)]), 'drone')
save(strip([cell(load('slime'), 128, pad=8), cell(load('slime'), 128, pad=8, sx=1.08, sy=0.88)]), 'slime')
save(strip([cell(load('guardian'), 192, angle=1.5), cell(load('guardian'), 192, angle=-1.5, lift=2)]), 'guardian')

for item in ['gear', 'cell', 'gel', 'lens', 'core', 'chip', 'prism']:
    save(cell(load('item_' + item), 96, pad=5), 'item_' + item)
save(cell(load('chest_0'), 128, pad=4), 'chest_0')
save(cell(load('chest_1'), 128, pad=4), 'chest_1')
coin = cell(load('coin'), 48, pad=2)
save(coin, 'coin')
# the cashback coin is the same coin in ShopBack red
r, g, b, a = coin.split()
cb = Image.merge('RGBA', (r, g.point(lambda v: int(v * 0.55)), b.point(lambda v: int(v * 0.9 + 20)), a))
save(ImageEnhance.Color(cb).enhance(1.2), 'cbcoin')
t = load('table')
save(t.resize((176, round(176 * t.height / t.width)), Image.LANCZOS), 'table')

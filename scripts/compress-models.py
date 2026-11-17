"""Shrinks the avatar GLBs in public/models by re-encoding their embedded textures.

  python3 scripts/compress-models.py

Geometry, skeleton and animation are copied untouched. Run it once on a fresh model;
running it again only re-encodes the already small texture.
"""
import io, json, struct, sys
from PIL import Image

SIZE, QUALITY = 1024, 82

def shrink(path):
    d = open(path, 'rb').read()
    jl = struct.unpack('<I', d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    binary = d[20 + jl + 8:]
    images = {im['bufferView']: im for im in j.get('images', [])}
    out = bytearray()
    for i, bv in enumerate(j['bufferViews']):
        chunk = binary[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        if i in images:
            im = Image.open(io.BytesIO(chunk)).convert('RGB')
            if max(im.size) > SIZE:
                im = im.resize((SIZE, SIZE * im.height // im.width), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
            chunk = buf.getvalue()
            images[i]['mimeType'] = 'image/jpeg'
        while len(out) % 4:
            out.append(0)
        bv['byteOffset'] = len(out)
        bv['byteLength'] = len(chunk)
        out += chunk
    while len(out) % 4:
        out.append(0)
    j['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    with open(path, 'wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(js), b'JSON') + js)
        f.write(struct.pack('<I4s', len(out), b'BIN\0') + bytes(out))
    print(path, len(d) // 1024, 'KB ->', total // 1024, 'KB')

for p in sys.argv[1:] or ['public/models/male.glb', 'public/models/female.glb']:
    shrink(p)

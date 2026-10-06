"""Create mobile GLBs from shipped models using macOS sips (no geometry changes).

Run: python3 scripts/assets/mobile-textures.py
Embedded maps are capped at 512px before download/decode/upload on the phone.
Buffer-view alignment, geometry, animations, alpha channels and licenses survive.
"""
import json
import pathlib
import struct
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2] / 'apps/web/public/models'
NAMES = ['rocketbox-soldier', 'polyhaven-apartment', 'polyhaven-factory',
         'polyhaven-street-tree', 'polyhaven-street-bench']

for name in NAMES:
    source = (ROOT / f'{name}.glb').read_bytes()
    json_length = struct.unpack_from('<I', source, 12)[0]
    document = json.loads(source[20:20 + json_length])
    binary = source[28 + json_length:]
    images = {image['bufferView']: image for image in document['images']}
    output = bytearray()
    with tempfile.TemporaryDirectory() as temporary:
        for index, view in enumerate(document['bufferViews']):
            start = view.get('byteOffset', 0)
            data = binary[start:start + view['byteLength']]
            if index in images:
                image = images[index]
                suffix = '.png' if image['mimeType'] == 'image/png' else '.jpg'
                path = pathlib.Path(temporary) / f'{index}{suffix}'
                path.write_bytes(data)
                subprocess.run(['sips', '-Z', '512', str(path)], check=True, capture_output=True)
                data = path.read_bytes()
            output.extend(b'\0' * (-len(output) % 4))
            view['byteOffset'], view['byteLength'] = len(output), len(data)
            output.extend(data)
    output.extend(b'\0' * (-len(output) % 4))
    document['buffers'][0]['byteLength'] = len(output)
    metadata = json.dumps(document, separators=(',', ':')).encode()
    metadata += b' ' * (-len(metadata) % 4)
    result = (struct.pack('<4sII', b'glTF', 2, 28 + len(metadata) + len(output))
              + struct.pack('<I4s', len(metadata), b'JSON') + metadata
              + struct.pack('<I4s', len(output), b'BIN\0') + output)
    (ROOT / f'{name}-mobile.glb').write_bytes(result)
    print(f'{name}: {len(source):,} -> {len(result):,} bytes')

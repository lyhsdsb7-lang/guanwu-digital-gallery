"""Create a presentation GLB with smaller textures and unchanged mesh data.

Requires Pillow. The supplied original GLB is never modified.
"""
import io
import json
import struct
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / '8c83d2ade1bc2ae3f25bac1d94cfdd33.glb'
target = root / 'public' / 'models' / 'artifact-fast.glb'
data = source.read_bytes()
assert struct.unpack_from('<III', data) == (0x46546C67, 2, len(data))
json_length, json_kind = struct.unpack_from('<II', data, 12)
assert json_kind == 0x4E4F534A
document = json.loads(data[20:20 + json_length])
bin_offset = 20 + json_length
bin_length, bin_kind = struct.unpack_from('<II', data, bin_offset)
assert bin_kind == 0x004E4942 and len(document['buffers']) == 1
binary = data[bin_offset + 8:bin_offset + 8 + bin_length]
images = {image['bufferView']: image for image in document['images']}
rebuilt = bytearray()
original_geometry = []
for index, view in enumerate(document['bufferViews']):
    start = view.get('byteOffset', 0)
    payload = binary[start:start + view['byteLength']]
    if index in images:
        image = Image.open(io.BytesIO(payload)).convert('RGB')
        image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        # Higher quality for the normal map preserves lighting detail.
        image.save(encoded, format='JPEG', quality=95 if index == 4 else 88, optimize=True, subsampling=0)
        payload = encoded.getvalue()
        images[index]['mimeType'] = 'image/jpeg'
    else:
        original_geometry.append((index, payload))
    rebuilt.extend(b'\0' * ((-len(rebuilt)) % 4))
    view['byteOffset'] = len(rebuilt)
    view['byteLength'] = len(payload)
    rebuilt.extend(payload)
document['buffers'][0]['byteLength'] = len(rebuilt)
rebuilt.extend(b'\0' * ((-len(rebuilt)) % 4))
encoded_json = json.dumps(document, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
encoded_json += b' ' * ((-len(encoded_json)) % 4)
result = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(encoded_json) + 8 + len(rebuilt))
result += struct.pack('<II', len(encoded_json), 0x4E4F534A) + encoded_json
result += struct.pack('<II', len(rebuilt), 0x004E4942) + rebuilt
for index, original in original_geometry:
    view = document['bufferViews'][index]
    assert original == rebuilt[view['byteOffset']:view['byteOffset'] + view['byteLength']]
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(result)
print(json.dumps({'original_bytes':len(data), 'optimized_bytes':len(result), 'reduction_percent':round(100 * (1 - len(result) / len(data)), 1), 'geometry_byte_identical':True}))

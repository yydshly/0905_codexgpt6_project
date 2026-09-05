"""Extract CC0 Quaternius Standard clips without meshes or textures.
Usage: python scripts/build-guide-motion.py [extracted-assets-directory]
Preserves the original bone-space samples; no generated or simulated motion.
"""
import json, pathlib, struct, sys

root = pathlib.Path(__file__).resolve().parent.parent
source = next(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / '.scratch/assets').rglob('UAL1_Standard.glb'))
data = source.read_bytes()
size = struct.unpack_from('<I', data, 12)[0]
original = json.loads(data[20:20 + size])
binary = data[28 + size:]
names = {'Walk_Loop', 'Sitting_Enter', 'Sitting_Exit', 'Sitting_Idle_Loop'}
out = {'asset': {'version': '2.0', 'generator': 'Quaternius CC0 / Ideal Study clip extraction'}, 'scene': 0,
       'scenes': [{'nodes': []}], 'nodes': [], 'animations': [], 'accessors': [], 'bufferViews': [], 'buffers': []}
blob = bytearray()
accessors = {}
nodes = {}
for anim in original['animations']:
    if anim['name'] not in names:
        continue
    anim = json.loads(json.dumps(anim))
    for channel in anim['channels']:
        old = channel['target']['node']
        if old not in nodes:
            nodes[old] = len(out['nodes'])
            out['nodes'].append({'name': original['nodes'][old]['name']})
            out['scenes'][0]['nodes'].append(nodes[old])
        channel['target']['node'] = nodes[old]
    for sampler in anim['samplers']:
        for key in ['input', 'output']:
            old = sampler[key]
            if old not in accessors:
                accessor = dict(original['accessors'][old])
                view = original['bufferViews'][accessor['bufferView']]
                start = view.get('byteOffset', 0)
                while len(blob) % 4:
                    blob.append(0)
                accessor['bufferView'] = len(out['bufferViews'])
                out['bufferViews'].append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': view['byteLength']})
                blob.extend(binary[start:start + view['byteLength']])
                accessors[old] = len(out['accessors'])
                out['accessors'].append(accessor)
            sampler[key] = accessors[old]
    out['animations'].append(anim)
out['buffers'] = [{'byteLength': len(blob)}]
encoded = json.dumps(out, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
blob.extend(b'\0' * (-len(blob) % 4))
result = struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(blob)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(blob), 0x004e4942) + blob
target = root / 'src/assets/guide/guide-motion-v1.glb'
target.write_bytes(result)
print(target, len(result), 'bytes', sorted(names))

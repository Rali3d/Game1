"""Copy the Quaternius models the game uses from models/ (the raw packs, not in git) into assets/,
with game-sized textures.

  python3 tools/build_assets.py

Why: the raw packs are ~1 GB with 4K textures, and one pack (the Bestiary) may not be redistributed as a
pack. The game only ships what it uses. Textures are shrunk with macOS `sips`; colour maps are kept, and
normal / roughness / occlusion maps are dropped (the stylised look doesn't need them, and it keeps
downloads small). Textures shared between models are written once, to assets/textures/<pack>/.
"""
import glob
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'models')
OUT = os.path.join(ROOT, 'assets')

CHARS = 'Modular Character Outfits - Fantasy[Standard]/Exports/glTF (Godot-Unreal)/Outfits'
BASE = 'Universal Base Characters[Standard]/Base Characters/Godot - UE'
HAIR = 'Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)'
NATURE = 'Stylized Nature MegaKit[Standard]/glTF'
PROPS = 'Fantasy Props MegaKit[Standard]/Exports/glTF'
VILLAGE = 'Medieval Village MegaKit[Standard]/glTF'

# (source folder, file glob patterns, output folder, max texture size)
GROUPS = [
    (CHARS, ['Male_Peasant', 'Male_Ranger', 'Female_Peasant', 'Female_Ranger'], 'characters', 1024),
    (BASE, ['Superhero_Male_FullBody', 'Superhero_Female_FullBody'], 'characters', 1024),
    (HAIR, ['Hair_*', 'Eyebrows_*'], 'characters', 512),
    (NATURE, ['CommonTree_*', 'Pine_*', 'TwistedTree_*', 'DeadTree_*', 'Rock_Medium_*', 'Bush_Common*',
              'Fern_1', 'Flower_3_Group', 'Flower_4_Group', 'Mushroom_Common', 'Plant_1', 'Plant_7',
              'Pebble_Round_*', 'Grass_Common_Short', 'Grass_Wispy_Short'], 'nature', 512),
    (PROPS, ['*'], 'props', 512),
    (VILLAGE, ['*'], 'village', 1024),
]
ANIMATIONS = [
    ('Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb', 'anims/UAL1.glb'),
    ('Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb', 'anims/UAL2.glb'),
]

done_textures = {}


def pack_name(folder):
    return folder.split('[')[0].strip().split(' ')[0].lower()  # 'Stylized Nature...' -> 'stylized'


def convert_texture(src_path, pack, max_size, keep_alpha):
    """Resize one texture; returns its path relative to assets/."""
    key = (src_path, keep_alpha)
    if key in done_textures:
        return done_textures[key]
    base = os.path.splitext(os.path.basename(src_path))[0]
    ext = 'png' if keep_alpha else 'jpg'
    rel = f'textures/{pack}/{base}.{ext}'
    dst = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    args = ['sips', '-Z', str(max_size)]
    if not keep_alpha:
        args += ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82']
    subprocess.run(args + [src_path, '--out', dst], check=True, capture_output=True)
    done_textures[key] = rel
    return rel


def find_image(folder, uri):
    """Images are sometimes next to the glTF, sometimes in the pack's Textures folder."""
    candidates = [os.path.join(folder, uri)]
    pack_root = os.path.join(SRC, os.path.relpath(folder, SRC).split(os.sep)[0])
    candidates += glob.glob(os.path.join(pack_root, '**', os.path.basename(uri)), recursive=True)
    stem = os.path.splitext(os.path.basename(uri))[0].replace('_png', '')
    candidates += glob.glob(os.path.join(pack_root, '**', stem + '.png'), recursive=True)
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def process_gltf(src_gltf, out_dir, max_size):
    folder = os.path.dirname(src_gltf)
    rel_folder = os.path.relpath(folder, SRC)
    pack = pack_name(rel_folder)
    with open(src_gltf) as f:
        g = json.load(f)
    name = os.path.splitext(os.path.basename(src_gltf))[0]
    os.makedirs(os.path.join(OUT, out_dir), exist_ok=True)

    for b in g.get('buffers', []):
        shutil.copy(os.path.join(folder, b['uri']), os.path.join(OUT, out_dir, os.path.basename(b['uri'])))

    # Keep only base colour textures.
    used = set()
    for m in g.get('materials', []):
        m.pop('normalTexture', None)
        m.pop('occlusionTexture', None)
        pbr = m.setdefault('pbrMetallicRoughness', {})
        if pbr.pop('metallicRoughnessTexture', None) is not None:
            pbr.setdefault('roughnessFactor', 0.85)
            pbr['metallicFactor'] = min(pbr.get('metallicFactor', 0.0), 0.3)
        if 'baseColorTexture' in pbr:
            used.add((g['textures'][pbr['baseColorTexture']['index']]['source'], m.get('alphaMode', 'OPAQUE') != 'OPAQUE'))
        if 'emissiveTexture' in m:
            used.add((g['textures'][m['emissiveTexture']['index']]['source'], False))

    for idx, image in enumerate(g.get('images', [])):
        alpha = any(i == idx and a for i, a in used)
        if not any(i == idx for i, _ in used):
            image['uri'] = ''  # never referenced by a material any more, so never fetched
            continue
        src = find_image(folder, image['uri'])
        if not src:
            print(f'  ! missing texture {image["uri"]} for {name}')
            continue
        rel = convert_texture(src, pack, max_size, alpha)
        image['uri'] = os.path.relpath(os.path.join(OUT, rel), os.path.join(OUT, out_dir))
        image.pop('mimeType', None)

    with open(os.path.join(OUT, out_dir, name + '.gltf'), 'w') as f:
        json.dump(g, f, separators=(',', ':'))
    return name


def main():
    if not os.path.isdir(SRC):
        sys.exit('models/ not found: put the Quaternius packs in Game1/models first.')
    credits = os.path.join(OUT, 'CREDITS.md')
    saved = open(credits).read() if os.path.exists(credits) else None
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT, exist_ok=True)
    if saved:
        with open(credits, 'w') as f:
            f.write(saved)
    manifest = {}
    for folder, patterns, out_dir, max_size in GROUPS:
        names = []
        for pat in patterns:
            for src in sorted(glob.glob(os.path.join(SRC, glob.escape(folder), pat + '.gltf'))):
                names.append(process_gltf(src, out_dir, max_size))
        manifest.setdefault(out_dir, []).extend(sorted(set(names)))
        print(f'{out_dir}: {len(names)} models')
    for src, dst in ANIMATIONS:
        os.makedirs(os.path.dirname(os.path.join(OUT, dst)), exist_ok=True)
        shutil.copy(os.path.join(SRC, src), os.path.join(OUT, dst))
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f'assets/: {total / 1e6:.1f} MB')


if __name__ == '__main__':
    main()

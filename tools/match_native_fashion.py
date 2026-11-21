#!/usr/bin/env python3
"""Find saved clothes in official stills by comparing decoded game atlas pixels.

Only match an *item* through genuine visual features, then require a preview for
that exact character ID; a male/female mannequin isn't the player's appearance.
This script does not guess how unrendered hair, hats or clothes should be layered.

Dependencies: opencv-python, numpy, Pillow. Run beside extract_native_parts.py.
"""
from __future__ import annotations
import argparse,base64,io,json,re,zipfile
from collections import defaultdict
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from extract_native_parts import atlas_regions, decode_png


def decode_preview(preview):
    return cv2.imdecode(np.frombuffer(base64.b64decode(preview['path'].split(',',1)[1]),np.uint8),cv2.IMREAD_UNCHANGED)


def gray_alpha(image):
    if image.shape[2]==4:
        gray=cv2.cvtColor(image,cv2.COLOR_BGRA2GRAY)
        gray[image[:,:,3]<100]=0
    else:gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
    return gray


def garment_descriptors(archive,sex,cloth,sift):
    prefix=f'{sex}/clothes_{cloth}'
    names=archive.namelist()
    if prefix+'.atlas' not in names or prefix+'.png' not in names:return []
    regions=sorted((r for r in atlas_regions(archive.read(prefix+'.atlas'))
        if r['name'].startswith('zheng_yifu') and r['w']>=23 and r['h']>=23),
        key=lambda r:r['w']*r['h'],reverse=True)
    if not regions:return []
    source=decode_png(archive.read(prefix+'.png'))
    result=[]
    for region in regions[:2]:
        crop=source.crop((region['x'],region['y'],region['x']+region['w'],region['y']+region['h']))
        if region['rotate']:crop=crop.transpose(Image.Transpose.ROTATE_90)
        ar=np.asarray(crop.convert('RGBA'))
        gray=cv2.cvtColor(ar[:,:,:3],cv2.COLOR_RGB2GRAY).copy()
        gray[ar[:,:,3]<100]=0
        gray=cv2.resize(gray,None,fx=2,fy=2,interpolation=cv2.INTER_LINEAR)
        kp,des=sift.detectAndCompute(gray,None)
        if des is not None:result.append((region['name'],des))
    return result


def find_matches(save_path,hero_path,fashion_path):
    source=Path(fashion_path).read_text('utf-8')
    m=re.search(r'<script id="fashion-data" type="application/json">(.*?)</script>',source,re.S)
    if not m:raise ValueError('Korean V6.24 fashion-data script not found')
    clothing=json.loads(m.group(1))['items']['outfit']
    save=json.loads(Path(save_path).read_text('utf-8'))
    roles=[save['MainRole'],*(save.get('Roles') or []),*(save.get('Leavers') or [])]
    sift=cv2.SIFT_create(nfeatures=800,contrastThreshold=.012)
    matcher=cv2.BFMatcher(cv2.NORM_L2)
    cache={}
    result=[]
    with zipfile.ZipFile(hero_path) as archive:
        for role in roles:
            sex='man' if role.get('Sex')==1 else 'woman' if role.get('Sex')==2 else None
            if not sex:continue
            rid=str(role.get('ID',''));cloth=role.get('Cloth')
            if not isinstance(cloth,int):continue
            if (sex,cloth) not in cache:cache[(sex,cloth)]=garment_descriptors(archive,sex,cloth,sift)
            descriptors=cache[(sex,cloth)]
            if not descriptors:continue
            normal='10030' if sex=='man' else '10029'
            candidates=[]
            for item in clothing:
                for image in item['previews']:
                    # A generic fashion mannequin can map garments, but never certify
                    # the full appearance of a different playable character.
                    if image['character_id'] not in (rid,normal):continue
                    preview_img=decode_preview(image)
                    if preview_img is None:continue
                    kp,des=sift.detectAndCompute(gray_alpha(preview_img),None)
                    if des is None:continue
                    points=0
                    for part,src in descriptors:
                        matches=matcher.knnMatch(src,des,k=2)
                        score=sum(a.distance<.72*b.distance for a,b in matches)
                        points=max(points,score)
                    if points<4:continue
                    candidates.append({'fashionId':item['id'],'name':item['name'],
                        'renderCharacterId':image['character_id'],'score':points})
            candidates.sort(key=lambda x:x['score'],reverse=True)
            exact=[x for x in candidates if x['renderCharacterId']==rid]
            chosen=exact[0] if exact else None
            # For character-specific stills, score >=12 is a conservative filter.
            # For generic mannequins, require >=18 and a clear runner-up separation.
            exact_ok=bool(chosen and chosen['score']>=12)
            runner=next((x for x in candidates if x['renderCharacterId']==normal
                         and (not candidates or x['fashionId']!=candidates[0]['fashionId'])),None)
            generic=candidates[0] if candidates and candidates[0]['renderCharacterId']==normal else None
            generic_ok=bool(generic and generic['score']>=18 and
                     (runner is None or generic['score']>=1.9*runner['score']))
            result.append({'roleId':rid,'characterName':role.get('Name'),
                'sex':sex,'cloth':cloth,
                'exactCharacterCandidate':chosen if exact_ok else None,
                'mannequinClothingCandidate':generic if generic_ok else None,
                'topCandidates':candidates[:5],
                'note':'A character-specific clothing match does not prove all other save accessories match'} )
    return result


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--save',required=True)
    ap.add_argument('--hero-zip',required=True)
    ap.add_argument('--fashion-html',required=True)
    ap.add_argument('--output',required=True)
    args=ap.parse_args()
    result=find_matches(args.save,args.hero_zip,args.fashion_html)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
    print(f'Compared {len(result)} roles; {sum(bool(r["exactCharacterCandidate"]) for r in result)} character-specific still candidates')

if __name__=='__main__':main()
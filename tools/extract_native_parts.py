#!/usr/bin/env python3
"""Extract verified save-selected attachment pixels from Korean game's hero.zip.
No full archive extraction, no Spine runtime; 2D atlas images are XOR-wrapped PNG.
"""
import argparse,base64,io,json,re,zipfile,collections
from pathlib import Path
from PIL import Image

KEY=b'HelloImage'

def decode_png(blob):
    if blob.startswith(b'JPGPNG'):
        blob=blob[6:]
        blob=bytes(b ^ KEY[i % len(KEY)] for i,b in enumerate(blob))
    image=Image.open(io.BytesIO(blob))
    image.load()
    return image.convert('RGBA')

def atlas_regions(data):
    """Parse one named Spine atlas; no .skel required to crop a source attachment."""
    result=[];page=None;name=None;info={}
    def flush():
        if name and 'xy' in info and 'size' in info and page:
            try:
                x,y=(int(v.strip()) for v in info['xy'].split(','))
                w,h=(int(v.strip()) for v in info['size'].split(','))
                result.append(dict(name=name,page=page,x=x,y=y,w=w,h=h,rotate=info.get('rotate','false')=='true'))
            except ValueError:pass
    for line in data.decode('utf-8-sig',errors='replace').splitlines():
        if not line.strip():continue
        if line[:1].isspace():
            if ':' in line:
                k,v=line.strip().split(':',1);info[k.strip()]=v.strip()
        elif line.strip().lower().endswith('.png'):
            flush();name=None;info={};page=line.strip()
        elif ':' not in line:
            flush();name=line.strip();info={}
    flush();return result


def build(zip_path,save_path,output):
    save=json.loads(Path(save_path).read_text('utf-8'))
    z=zipfile.ZipFile(zip_path)
    names=set(z.namelist())
    cache_atlas={};cache_image={}
    def atlas(sex,filename):
        path=f'{sex}/{filename}.atlas'
        if path not in names:return []
        if path not in cache_atlas:cache_atlas[path]=atlas_regions(z.read(path))
        return cache_atlas[path]
    def get_image(sex,page):
        path=f'{sex}/{page}'
        if path not in names:return None
        if path not in cache_image:cache_image[path]=decode_png(z.read(path))
        return cache_image[path]
    kinds=[('얼굴','Face','face',lambda sex,n: [(f'face_{sex}',f'zheng_face{n}_'),('NST_20160621','zheng_face_1') if n==1 else ('none','')]),
           ('머리','BaseHair','hair',lambda sex,n:[(f'hair_{sex}',f'fair{i}_{"m" if sex=="man" else "f"}_z_{n}_') for i in range(1,4)]),
           ('의상','Cloth','clothes',lambda sex,n:[(f'clothes_{n}',f'zheng_yifu_{n}_'),(f'clothes_{n}',f'zheng_qun_{n}_')]),
           ('신발','Shoe','clothes',lambda sex,n:[(f'clothes_{n}',f'zheng_z_xie_{n}_'),(f'clothes_{n}',f'zheng_y_xie_{n}_')]),
           ('모자','Hat','clothes',lambda sex,n:[(f'clothes_{n}',f'zheng_toushi_{n}_')]),
           ('망토','Pifeng','clothes',lambda sex,n:[(f'clothes_{n}',f'zheng_pifeng_{n}_')])]
    entries={};all_roles=[save['MainRole'],*list(save.get('Roles',[]))]
    coverage=collections.Counter();unknown=[]
    for role in all_roles:
        sex='man' if role.get('Sex')==1 else 'woman' if role.get('Sex')==2 else None
        if not sex:continue
        for label,field,category,candidates in kinds:
            n=role.get(field)
            if not isinstance(n,int) or n<=0 or field=='Hat' and n==1:continue
            key=f'{sex}:{field}:{n}'
            if key in entries:continue
            matches=[]
            for fname,prefix in candidates(sex,n):
                if fname=='none':continue
                # Must match exact item ID and its optional child suffix.
                for region in atlas(sex,fname):
                    if region['name']==prefix.rstrip('_') or region['name'].startswith(prefix):
                        if region['w']>8 and region['h']>8:matches.append((region['w']*region['h'],fname,region))
            matches.sort(key=lambda z:z[0],reverse=True)
            if not matches:
                unknown.append(key);continue
            _,filename,region=matches[0]
            im=get_image(sex,region['page'])
            if im is None:unknown.append(key);continue
            crop=im.crop((region['x'],region['y'],region['x']+region['w'],region['y']+region['h']))
            if region['rotate']:crop=crop.transpose(Image.Transpose.ROTATE_90)
            buf=io.BytesIO();crop.save(buf,'PNG',optimize=True)
            entries[key]={'label':label,'field':field,'id':n,'sex':sex,
               'source':sex+'/'+filename+'.atlas#'+region['name'],
               'size':[crop.width,crop.height],
               'src':'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode('ascii')}
            coverage[field]+=1
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text('/* Verified hero.zip game pixel crops, not a composed full-body screenshot. */\nwindow.NANGMAN_NATIVE_SAVED_PARTS='+json.dumps(entries,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    stats={'parts':len(entries),'bytes':output.stat().st_size,'coverage':dict(coverage),'unavailable':unknown}
    Path(output.with_suffix('.report.json')).write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(stats,ensure_ascii=False,indent=2)[:3500]);return stats

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--hero',default='/mnt/data/files/hero.zip');p.add_argument('--save',default='/mnt/data/files/latest_save(1).json');p.add_argument('--output',default='/mnt/data/native_saved_parts.js');a=p.parse_args();build(a.hero,a.save,Path(a.output))
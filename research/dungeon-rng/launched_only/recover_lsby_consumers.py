import sys,struct,importlib.util,hashlib,json
from pathlib import Path
D=Path('/mnt/data/dungeon_native/source_original');sys.path.insert(0,str(D/'decoder/source'));sys.path.insert(0,str(D.parent/'v140/dungeon_v139'))
spec=importlib.util.spec_from_file_location('auditor',D/'decoder/selected/audit_uploaded_whales.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
from bytecode_write_order_v139 import Recorder
b=(D/'wapp__story__event(1).whale').read_bytes();s,n,v=struct.unpack_from('<IHH',b)
for name,size in [('lsby_boss2',12733),('lsby_boss3',20021),('lsby_boss4',28893)]:
 candidate=[i for i in range(n) if struct.unpack_from('<IIIII',b,s+20*i)[2]==size]
 print(name,'candidate',candidate)
 assert len(candidate)==1
 i=candidate[0]; blob,meta=a.whale_extract(D/'wapp__story__event(1).whale',i)
 plain=a.decrypt(blob);dec,proto,ins=a.inner_decode(plain)
 f=D/f'{name}.recovered.sbc';f.write_bytes(dec)
 r=Recorder();p,tree,ops=r.run(f)
 print(name,'SHA256',hashlib.sha256(dec).hexdigest(),'protos',proto,'instructions',ins,'sample',str(tree)[:160])
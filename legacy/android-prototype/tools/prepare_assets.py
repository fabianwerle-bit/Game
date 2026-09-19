"""Convert original Kenney CC0 OBJ/MTL meshes to compact vertex-colour buffers.
No substitute building geometry is generated. Palette textures are sampled at UVs.
"""
from pathlib import Path
import struct,math,json,shutil
from PIL import Image
root=Path(__file__).resolve().parents[2]/'toolchain/assets'
out=Path(__file__).resolve().parents[1]/'assets'
spec={
 'shop0':('city-kit-commercial','building-a'),'shop1':('city-kit-commercial','building-c'),
 'shop2':('city-kit-commercial','building-g'),'shop3':('city-kit-commercial','building-e'),
 'parasol':('city-kit-commercial','detail-parasol-a'), 'awning':('city-kit-commercial','detail-awning'),
 'palm':('nature-kit','tree_palmDetailedTall'), 'flowerYellow':('nature-kit','flower_yellowC'),
 'flowerPurple':('nature-kit','flower_purpleB'),
 'trash0':('food-kit','soda-can-crushed'),'trash1':('food-kit','soda-bottle'),'trash2':('food-kit','carton-small'),
 'house0':('city-kit-suburban','building-type-a'), 'house1':('city-kit-suburban','building-type-c'),
 'house2':('city-kit-suburban','building-type-g'), 'house3':('city-kit-suburban','building-type-o'),
 'tree':('city-kit-suburban','tree-large'),'treeSmall':('city-kit-suburban','tree-small'),
 'fence':('city-kit-suburban','fence-1x4'), 'path':('city-kit-suburban','path-short'),
 'road':('city-kit-roads','road-straight'),'cross':('city-kit-roads','road-crossroad'),
 'lamp':('city-kit-roads','light-curved'),
 'car0':('car-kit','hatchback-sports'),'car1':('car-kit','taxi'),'car2':('car-kit','van'),'car3':('car-kit','sedan'),
 'person0':('mini-characters','character-male-a'),'person1':('mini-characters','character-female-a'),
 'person2':('mini-characters','character-male-c'),'person3':('mini-characters','character-female-c'),
 'grass':('nature-kit','ground_grass'),'bush':('nature-kit','plant_bushLarge'),
 'flower':('nature-kit','flower_redA'),'rock':('nature-kit','stone_smallB'),
}
meta={}
for name,(pack,model) in spec.items():
 file=root/pack/'Models/OBJ format'/f'{model}.obj'
 if not file.exists():
  print('MISSING',file);continue
 mats={};mat=None
 for line in file.with_suffix('.mtl').read_text().splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='newmtl':mat=a[1];mats[mat]={'kd':[1,1,1]}
  elif a[0]=='Kd':mats[mat]['kd']=list(map(float,a[1:4]))
  elif a[0]=='map_Kd':mats[mat]['im']=Image.open(file.parent/' '.join(a[1:])).convert('RGB')
 vs=[];vns=[];uvs=[];faces=[];mat=next(iter(mats))
 for line in file.read_text().splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='v':vs.append(list(map(float,a[1:4])))
  elif a[0]=='vn':vns.append(list(map(float,a[1:4])))
  elif a[0]=='vt':uvs.append(list(map(float,a[1:3])))
  elif a[0]=='usemtl':mat=a[1]
  elif a[0]=='f':
   inds=[list(map(lambda x:int(x) if x else 0,v.split('/'))) for v in a[1:]]
   for i in range(1,len(inds)-1):faces.append((mat,[inds[0],inds[i],inds[i+1]]))
 mins=[min(v[k] for v in vs) for k in range(3)];maxs=[max(v[k] for v in vs) for k in range(3)]
 centre=[(mins[0]+maxs[0])/2,mins[1],(mins[2]+maxs[2])/2]
 data=[]
 for mat,face in faces:
  pts=[vs[v[0]-1] for v in face];a=[pts[1][k]-pts[0][k] for k in range(3)];b=[pts[2][k]-pts[0][k] for k in range(3)]
  n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];mag=math.sqrt(sum(x*x for x in n)) or 1;n=[x/mag for x in n]
  for ids in face:
   xyz=[vs[ids[0]-1][k]-centre[k] for k in range(3)];normal=vns[ids[2]-1] if len(ids)>2 and ids[2] else n
   m=mats[mat];rgb=m['kd']
   if 'im' in m and len(ids)>1 and ids[1]:
    uv=uvs[ids[1]-1];im=m['im'];px=max(0,min(im.width-1,int(uv[0]*im.width)));py=max(0,min(im.height-1,int((1-uv[1])*im.height)));rgb=[c/255 for c in im.getpixel((px,py))]
   # Preserve the downloaded geometry and material regions; give facades a
   # cheerful coastal palette instead of identical white city-kit walls.
   if name.startswith(('house','shop')):
    index=int(name[-1]);palette=[(.99,.60,.30),(1.0,.82,.34),(.29,.80,.87),(.97,.50,.64)]
    if min(rgb)>.73 and max(rgb)-min(rgb)<.17:
     rgb=[palette[index][k]*(.83+.17*rgb[k]) for k in range(3)]
    elif name.startswith('house') and rgb[1]>.40 and rgb[1]>rgb[0]*1.28 and rgb[1]>rgb[2]*1.08:
     roof=[(.89,.27,.16),(.24,.60,.80),(.98,.50,.22),(.65,.30,.62)][index];rgb=list(roof)
   data.extend(xyz+normal+rgb)
 with open(out/'models'/f'{name}.mesh','wb') as f:f.write(struct.pack('>i',len(data)//9));f.write(struct.pack('>'+str(len(data))+'f',*data))
 meta[name]={'size':[round(maxs[k]-mins[k],5) for k in range(3)],'vertices':len(data)//9,'source':f'{pack}/{model}'}
 print(name,meta[name])
for pack in sorted(set(v[0] for v in spec.values())):shutil.copy(root/pack/'License.txt',out/'licenses'/f'{pack}.txt')
(out/'models.json').write_text(json.dumps(meta,indent=2))

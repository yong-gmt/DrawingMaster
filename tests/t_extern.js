const _fs=require('fs'), _p=require('path');
const OUTDIR=_p.join(require('./harness').ROOT,'tests','out');
_fs.mkdirSync(OUTDIR,{recursive:true});
/* files a test writes go here, never into the fixture folders */
function OUT(n){ return _p.join(OUTDIR, _p.basename(n)); }
// Judged by a library that has never seen this app: ezdxf reads the exported file
// and is asked to measure every dimension itself. If its numbers match the
// original drawing's, the file really is a drawing and not a picture of one.
const {open,loadDxf}=require('./harness');
const fs=require('fs'), {execSync}=require('child_process');
(async()=>{
 for(const src of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf','Body_Demo_Drawing_Sheet1.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,src);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const R=await pg.evaluate(()=>{ const h=window.__hook();
    return h.buildDXF(h.store.pages.find(x=>x.id===h.store.activeId)); });
  fs.writeFileSync(OUT('ext_'+src), R.text);
  await b.close();
  console.log(execSync(`python3 - <<'PY'
import ezdxf, collections
O=ezdxf.readfile(${JSON.stringify(require('./harness').fixture(src))}); N=ezdxf.readfile(${JSON.stringify(OUT('ext_'+src))})
o=O.modelspace(); n=N.modelspace()
# Compare what each dimension SAYS it measures (group 42, the value the drawing
# prints), not a re-derivation - some writers leave definition points a reader can
# interpret two ways, and 42 is the number the drawing office signed off.
def dims(m):
    out=[]
    for e in m:
        if e.dxftype()!='DIMENSION': continue
        v=getattr(e.dxf,'actual_measurement',None)
        if v is None: v=e.get_measurement()
        out.append((e.dimtype & 15, round(float(v),2)))
    return sorted(out)
# count arcs wherever they live - the original keeps some inside blocks, we
# flatten those into modelspace, so counting one place only compares apples to pears
# Compare the SET of radii, to 2 dp. Counts cannot be compared: the original keeps
# a block and inserts it three times where we write the three copies out flat, so a
# count difference says nothing about whether the shapes are right.
def rad(d,k):
    out=set()
    for e in d.modelspace():
        if e.dxftype()==k: out.add(round(e.dxf.radius,2))
    for b in d.blocks:
        if b.name.startswith(('*D','*Model','*Paper')): continue
        for e in b:
            if e.dxftype()==k: out.add(round(e.dxf.radius,2))
    return sorted(out)
a,b=dims(o),dims(n)
print(${JSON.stringify(src)})
import collections
sa,sb=collections.Counter(a),collections.Counter(b)
lost=[t for t in (sa-sb).elements()]
print('  dimensions   :', len(a), '->', len(b), '| measurements identical:', a==b)
if lost: print('    not re-published as DIMENSION:', lost,
               '   (type 2/5 = angular, not modelled yet)')
print('  CIRCLE radii :', len(rad(O,'CIRCLE')), '->', len(rad(N,'CIRCLE')),
      '| identical:', rad(O,'CIRCLE')==rad(N,'CIRCLE'))
oa,na=set(rad(O,'ARC')), set(rad(N,'ARC'))
print('  ARC radii    :', len(oa), '->', len(na), '| identical:', oa==na)
if na-oa: print('    extra arcs:', sorted(na-oa),
                '   (an unmodelled dimension published as plain geometry)')
if oa-na: print('    MISSING arcs:', sorted(oa-na))
bad=[e.dxf.text for e in n if e.dxftype()=='DIMENSION' and '<>' not in e.dxf.text]
print('  values pinned as literal text:', len(bad), bad[:3])
PY`).toString().trim());
 }
})();

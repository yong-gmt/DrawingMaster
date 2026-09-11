const {open,loadDxf}=require('./harness');
const fs=require('fs'), {execSync}=require('child_process');
// Check EVERY dimension in the exported file - however many there are - for the
// two things that decide what another CAD will draw: the block we hand it, and the
// style overrides it needs if it decides to rebuild the dimension itself.
(async()=>{
 for(const src of ['Head-back.dxf','Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,src);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const R=await pg.evaluate(()=>{ const h=window.__hook();
    return h.buildDXF(h.store.pages.find(x=>x.id===h.store.activeId)); });
  fs.writeFileSync(require('./harness').out('exdim_'+src), R.text);
  await b.close();
  console.log(execSync(`python3 - <<'PY'
import ezdxf, collections
d=ezdxf.readfile(${JSON.stringify(require('./harness').out('exdim_'+src))})
want={0:2, 1:2, 3:1, 4:1}          # linear/aligned two arrows, radius/diameter one
rows=[]
for e in d.modelspace():
    if e.dxftype()!='DIMENSION': continue
    t=e.dimtype & 15
    blk=d.blocks.get(e.dxf.geometry)
    arrows=sum(1 for x in blk if x.dxftype()=='SOLID')
    ov=e.override().dimstyle_attribs
    rows.append((t, arrows, want.get(t), bool(ov), ov.get('dimtofl'), ov.get('dimtix')))
print(${JSON.stringify(src)})
print('  dimensions:', len(rows))
bad=[r for r in rows if r[2] is not None and r[1]!=r[2]]
print('  wrong number of arrowheads in the block:', len(bad), bad[:4])
print('  missing style overrides:', sum(1 for r in rows if not r[3]))
rad=[r for r in rows if r[0] in (3,4)]
print('  radius/diameter told not to draw across:',
      sum(1 for r in rad if r[4]==0 and r[5]==0), '/', len(rad))
PY`).toString().trim());
 }
})();

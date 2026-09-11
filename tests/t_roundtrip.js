const {open,loadDxf}=require('./harness');
const fs=require('fs');
// Export, then IMPORT WHAT WE EXPORTED. If the dimensions do not come back as
// DIMENSION entities with the same measurements, the file is not editable
// anywhere else either - and the only honest way to know is to read it back.
(async()=>{
 for(const src of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf','Body_Demo_Drawing_Sheet1.dxf']){
  // 1. import the original, stylize, export
  let R, before;
  {
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,src);
    await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    const out=await pg.evaluate(()=>{ const h=window.__hook();
      const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const R=h.buildDXF(P);
      const dims=(P.dxf.dims||[]).filter(m=>m.ok).map(m=>({
        kind:m.kind,
        value:+(m.kind==='radial'? m.radius : m.kind==='diameter'? m.radius*2
              : Math.abs(h.dimGeomOf(m).span[1]-h.dimGeomOf(m).span[0])).toFixed(3)
      })).sort((x,y)=>x.value-y.value);
      return {R, dims};
    });
    R=out.R; before=out.dims;
    fs.writeFileSync(require('./harness').out('rt_'+src), R.text);
    await b.close();
  }
  // 2. count what the file itself contains
  const s=R.text.replace(/\r/g,'').split('\n').map(x=>x.trim());
  const kinds={}, secs=[];
  for(let i=0;i<s.length-1;i+=2){
    if(s[i]==='0') kinds[s[i+1]]=(kinds[s[i+1]]||0)+1;
    if(s[i]==='2' && ['HEADER','TABLES','BLOCKS','ENTITIES'].includes(s[i+1])) secs.push(s[i+1]);
  }
  // 3. read it back in
  const {b,pg}=await open(require('./harness').APP);
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,100)));
  await loadDxf(pg,require('./harness').out('rt_'+src));
  const after=await pg.evaluate(()=>{
    const h=window.__hook(); const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf;
    const lays={}; (d.polys||[]).forEach(p=>{ const k=p._layer||'?'; lays[k]=(lays[k]||0)+1; });
    return { models:(d.dims||[]).length, ok:(d.dims||[]).filter(m=>m.ok).length,
      dims:(d.dims||[]).map(m=>({kind:m.kind,
        value:+(m.kind==='radial'? m.radius : m.kind==='diameter'? m.radius*2
              : Math.abs(h.dimGeomOf(m).span[1]-h.dimGeomOf(m).span[0])).toFixed(3)
      })).sort((x,y)=>x.value-y.value),
      layers:Object.keys(lays).length, dashed:(d.polys||[]).filter(p=>p.dash).length };
  });
  const same=JSON.stringify(before)===JSON.stringify(after.dims);
  console.log(src);
  console.log('  file has        :', secs.join('+'), '| DIMENSION', kinds.DIMENSION||0,
              '| BLOCK', kinds.BLOCK||0, '| LAYER', kinds.LAYER||0, '| LTYPE', kinds.LTYPE||0);
  console.log('  read back       :', after.models, 'dimensions,', after.layers,
              'layers,', after.dashed, 'lines with a line type');
  console.log('  measurements match original:', same,
              same?'':'\n    before '+JSON.stringify(before.slice(0,6))+
                     '\n    after  '+JSON.stringify(after.dims.slice(0,6)));
  console.log('  import errors   :', errs.length);
  await b.close();
 }
})();

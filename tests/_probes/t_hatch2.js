const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'hatch_test.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.hatches||[]).map((ht,i)=>({
      i, pattern:ht.pattern, loops:ht.loops.length,
      fams:h.hatchFamilies(ht).map(f=>{ const S=h.hatchStep(f); return {
        angleDeg:+(Math.atan2(f.dir[1],f.dir[0])*180/Math.PI).toFixed(2),
        spacing:+S.spacing.toFixed(3), shift:+S.shift.toFixed(3),
        base:f.base.map(v=>+v.toFixed(2)), dashes:f.dashes,
        canvasDash:h.hatchDashArray(f.dashes,1) };})
    }));
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();

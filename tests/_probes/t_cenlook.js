const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const info=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter'))
      .map(m=>{ const g=h.dimGeomOf(m);
        return {id:m.id, val:String(m.text.override||m.text.value), kind:m.kind,
          r:+m.radius.toFixed(2),
          centre:g.centreAt.map(v=>+v.toFixed(1)),
          arrowAt:g.segs[0].b.map(v=>+v.toFixed(1)),
          elbow:g.elbow.map(v=>+v.toFixed(1)),
          text:[+g.text.x.toFixed(1),+g.text.y.toFixed(1)],
          far:g.foreshortened}; });
  });
  console.log(JSON.stringify(info,null,0));
  await pg.evaluate(()=>{ const h=window.__hook(); h.zoomRect(60,88,120,130); });
  await pg.waitForTimeout(350);
  fs.writeFileSync('cenlook.png', await pg.locator('canvas').first().screenshot());
  await b.close();
})();

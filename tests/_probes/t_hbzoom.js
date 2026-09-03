const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const info=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter'))
      .map(m=>({id:m.id, kind:m.kind, r:+m.radius.toFixed(2),
        val:m.text.override||m.text.value,
        centre:m.centre.map(v=>+v.toFixed(1)), point:m.point.map(v=>+v.toFixed(1))}));
  });
  console.log(JSON.stringify(info,null,0));
  // frame the front view where most of the radius dims live
  await pg.evaluate(()=>{ const h=window.__hook(); h.zoomRect(55,105,115,175); });
  await pg.waitForTimeout(350);
  fs.writeFileSync('hbz1.png', await pg.locator('canvas').first().screenshot());
  await b.close();
})();

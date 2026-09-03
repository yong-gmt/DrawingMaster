const {open,loadDxf}=require('../tests/harness');
const fs=require('fs'), path=require('path');
const OUT=path.join(__dirname,'..','tests','out'); fs.mkdirSync(OUT,{recursive:true});
// The whole marker, before and after STYLIZE, for every marker in every file.
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  for(const phase of ['before','after']){
    const {b,pg}=await open('DrawingMaster.html');
    await loadDxf(pg,dxf);
    if(phase==='after'){ await pg.evaluate(()=>document.querySelector('#btnStylize').click());
                         await pg.waitForTimeout(900); }
    const n=await pg.evaluate(()=>{ const h=window.__hook();
      const P=h.store.pages.find(x=>x.id===h.store.activeId);
      return (P.dxf.secs||[]).filter(s=>s.ok).length; });
    for(let i=0;i<n;i++){
      const info=await pg.evaluate((i)=>{
        const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
        const s=(P.dxf.secs||[]).filter(x=>x.ok)[i];
        const g=h.secGeomOf(s);
        const xs=g.pts.map(p=>p[0]), ys=g.pts.map(p=>p[1]);
        h.zoomRect(Math.min(...xs)-16, Math.min(...ys)-16, Math.max(...xs)+16, Math.max(...ys)+16);
        h.setSelection([]); h.render();
        return {letter:s.letter, views:s.ends.map(e=>e.view.map(v=>+v.toFixed(2))),
                ends:s.ends.map(e=>e.p.map(v=>+v.toFixed(1))),
                pts:g.pts.map(p=>p.map(v=>+v.toFixed(1)))};
      }, i);
      await pg.waitForTimeout(400);
      fs.writeFileSync(path.join(OUT, `m_${dxf.slice(0,4)}_${i}_${phase}.png`),
                       await pg.locator('canvas').first().screenshot());
      console.log(dxf, 'marker', i, phase, JSON.stringify(info));
    }
    await b.close();
  }
 }
})();

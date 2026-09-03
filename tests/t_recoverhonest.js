const {open,loadDxf}=require('./harness');
// Rebuilding dimensions from bare geometry, judged the hard way: a rebuilt
// dimension must MEASURE what its own value says. Counting how many were rebuilt
// says nothing about whether they are right.
const FILES=['expl_Body_Demo_Drawing_Sheet1.dxf','expl_Head-back.dxf',
             'expl_Body_Demo_Drawing_Sheet3.dxf','exploded.dxf'];
(async()=>{
 for(const dxf of FILES){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1400);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let rebuilt=0, disagree=0; const eg=[];
    (P.dxf.dims||[]).filter(m=>m.ok && m.refs).forEach(m=>{
      rebuilt++;
      let txt=null;
      (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{ if(t._dim===m.id) txt=String(t.text); }));
      /* "2x R1.50" states 1.50 twice over - strip the count before the number,
         or the check reads 21.50 and calls a correct dimension wrong. */
      const cleaned=String(txt||'').replace(/^\s*\d+\s*[xX]\s*/,'');
      const mm=cleaned.match(/\d+(?:[.,]\d+)?/);
      const stated=mm? parseFloat(mm[0].replace(',','.')) : NaN;
      if(!isFinite(stated)) return;
      /* A linear dimension measures the distance ALONG its own direction, not the
         straight line between the two points it touches - those can sit at
         different heights. Measuring point-to-point called sixteen correct
         dimensions wrong. */
      const got = m.kind==='radial' ? m.radius
                : m.kind==='diameter' ? m.radius*2
                : Math.abs(h.dimGeomOf(m).span[1] - h.dimGeomOf(m).span[0]);
      if(!isFinite(got)) return;
      if(Math.abs(got-stated) > Math.max(0.05, stated*0.01)){
        disagree++; if(eg.length<4) eg.push(txt+' measures '+got.toFixed(2)); }
    });
    return {rebuilt, disagree, eg};
  });
  console.log((dxf+'                                  ').slice(0,38),
    'rebuilt', String(r.rebuilt).padStart(3),
    '· disagreeing with their own value', String(r.disagree).padStart(3));
  if(r.eg.length) console.log('      ', r.eg.join(' · '));
  await b.close();
 }
})();

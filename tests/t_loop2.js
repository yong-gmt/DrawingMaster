const {open,loadDxf}=require('./harness');
// Two things the loop has to do:
//   1. converge - a second press must not move anything
//   2. re-scan  - anything that turns up AFTER the first press must be picked up
// So we press once, then drop a brand-new exploded dimension onto the drawing and
// press again.
(async()=>{
 for(const dxf of ['Head-back.dxf','exploded.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const snap=()=>pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const S=[]; (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>S.push('P|'+JSON.stringify(p.pts)));
      (o.prims.texts||[]).forEach(t=>S.push('T|'+[t.x.toFixed(3),t.y.toFixed(3),t.h,t.text].join(','))); });
    return S.sort().join(';'); });
  const count=()=>pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return {models:(P.dxf.dims||[]).filter(m=>m.ok).length,
            left:h.stylizeLeftovers(P).length}; });

  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const a=await count(); const s1=await snap();
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const s2=await snap();

  // now put a NEW dimension on the sheet as raw geometry, the way an outside tool
  // or a paste would: two arrowheads facing each other, extension lines, a number
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf, y=20, x0=40, x1=65;             // a clear patch of the sheet
    const tri=(tip,dir)=>{ const w=0.42;
      return [[tip[0],tip[1]],
              [tip[0]-dir*2.5, tip[1]+w],
              [tip[0]-dir*2.5, tip[1]-w]]; };
    d.solids.push(tri([x0,y],-1)); d.solids.push(tri([x1,y],1));
    d.polys.push({pts:[[x0,y],[x1,y]], dash:null, _layer:'NEW'});
    d.polys.push({pts:[[x0,y-6],[x0,y+2]], dash:null, _layer:'NEW'});
    d.polys.push({pts:[[x1,y-6],[x1,y+2]], dash:null, _layer:'NEW'});
    d.texts.push({x:(x0+x1)/2, y:y+1.2, h:2.5, text:'25.00', rot:0, align:1, _layer:'NEW'});
    h.buildObjects(P); h.render();
  });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const c=await count();

  console.log(dxf);
  console.log('  after the first press     : models', a.models, '| values unmatched', a.left);
  console.log('  pressing again moved things:', s1!==s2);
  console.log('  a NEW dimension added later: picked up on the next press:',
              c.models===a.models+1, '(models now '+c.models+')');
  await b.close();
 }
})();

const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const id=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    let best=null;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
      const u=m.dir,D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const w=Math.abs(D(m.measure.p2,u)-D(m.measure.p1,u));
      if(!best||w>best.w) best={m,w};
    });
    return best.m.id;
  });
  for(const [tag,mode] of [['a_out','out'],['b_in','in']]){
    await pg.evaluate(({id,mode})=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=h.dimModelById(P,id), u=m.dir, D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const tA=Math.min(D(m.measure.p1,u),D(m.measure.p2,u));
      const tB=Math.max(D(m.measure.p1,u),D(m.measure.p2,u));
      m.text.t = (mode==='out') ? tB+12 : null;
      h.dimFitForm(m); h.dimApply(P,m); h.render();
      const g=h.dimGeomOf(m), n=[-u[1],u[0]];
      const c=[u[0]*tB+n[0]*m.line.q, u[1]*tB+n[1]*m.line.q];
      h.zoomRect(c[0]-30,c[1]-22,c[0]+22,c[1]+22);
    }, {id,mode});
    await pg.waitForTimeout(300);
    fs.writeFileSync('in_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  }
  await b.close();
})();

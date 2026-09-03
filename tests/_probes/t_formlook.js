const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const id=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // a roomy inside-form dimension, so the change of form is obvious
    let best=null;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir&&!m.line.arrowsOut).forEach(m=>{
      const u=m.dir,D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const w=Math.abs(D(m.measure.p2,u)-D(m.measure.p1,u));
      if(!best||w>best.w) best={m,w};
    });
    return best.m.id;
  });
  for(const [tag,push] of [['inside',0],['outside',16]]){
    await pg.evaluate(({id,push})=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=h.dimModelById(P,id), u=m.dir, D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const tB=Math.max(D(m.measure.p1,u), D(m.measure.p2,u));
      m.text.t = push? tB+push : null;
      if(push) h.dimFitForm(m); else if(m.line0) Object.assign(m.line, m.line0);
      h.dimApply(P,m);
      const g=h.dimGeomOf(m);
      const xs=[g.text.x], ys=[g.text.y];
      g.segs.concat(g.ext).forEach(s=>{ if(s.hidden||!s.a) return;
        xs.push(s.a[0],s.b[0]); ys.push(s.a[1],s.b[1]); });
      h.zoomRect(Math.min(...xs)-8,Math.min(...ys)-8,Math.max(...xs)+8,Math.max(...ys)+8);
      h.render();
    }, {id,push});
    await pg.waitForTimeout(300);
    fs.writeFileSync('form_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  }
  console.log(id);
  await b.close();
})();

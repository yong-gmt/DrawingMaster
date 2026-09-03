const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const id='dim42';
  for(const [tag,push] of [['inside',0],['outside',16]]){
    await pg.evaluate(({id,push})=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=h.dimModelById(P,id), u=m.dir, D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const tB=Math.max(D(m.measure.p1,u), D(m.measure.p2,u));
      m.text.t = push? tB+push : null;
      if(push) h.dimFitForm(m); else if(m.line0) Object.assign(m.line, m.line0);
      h.dimApply(P,m); h.render();
      // frame tightly on the far end, where the arrow lives
      const g=h.dimGeomOf(m);
      const n=[-u[1],u[0]];
      const c=[u[0]*tB+n[0]*m.line.q, u[1]*tB+n[1]*m.line.q];
      h.zoomRect(c[0]-14,c[1]-14,c[0]+14,c[1]+14);
    }, {id,push});
    await pg.waitForTimeout(300);
    fs.writeFileSync('zf_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  }
  await b.close();
})();

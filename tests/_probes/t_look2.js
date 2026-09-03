const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
 for(const [tag,file] of [['a',_p.join(require('./harness').ROOT,'src','base.html')],['b',require('./harness').APP]]){
  const {b,pg}=await open(file);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // zoom on the widest plain (inside-form) dimension so centring is obvious
    let best=null;
    (P.dxf.dims||[]).forEach(m=>{ if(!m.ok||(m.line&&m.line.arrowsOut)) return;
      const u=m.dir,D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const w=Math.abs(D(m.measure.p2,u)-D(m.measure.p1,u));
      if(!best||w>best.w) best={m,w}; });
    if(!best) return; const m=best.m, u=m.dir, n=[-u[1],u[0]];
    const S=[D=>0];
    const t1=m.measure.p1[0]*u[0]+m.measure.p1[1]*u[1], t2=m.measure.p2[0]*u[0]+m.measure.p2[1]*u[1];
    const A=[u[0]*Math.min(t1,t2)+n[0]*m.line.q, u[1]*Math.min(t1,t2)+n[1]*m.line.q];
    const B=[u[0]*Math.max(t1,t2)+n[0]*m.line.q, u[1]*Math.max(t1,t2)+n[1]*m.line.q];
    h.zoomRect(Math.min(A[0],B[0])-4, Math.min(A[1],B[1])-8, Math.max(A[0],B[0])+4, Math.max(A[1],B[1])+8);
  });
  await pg.waitForTimeout(300);
  fs.writeFileSync('wide_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  await b.close();
 }
})();

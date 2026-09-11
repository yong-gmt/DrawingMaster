const {open,loadDxf}=require('./harness');
const fs=require('fs');
// The 5.00 from the picture: a tight vertical dimension whose value was outside.
// Drag it in and check the arrowheads end up INSIDE, tips exactly on the extension
// lines, pointing outward, with nothing drawn beyond them.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const D=(p,v)=>p[0]*v[0]+p[1]*v[1];
    const m=(P.dxf.dims||[]).find(x=>x.ok&&x.dir&&x.line.arrowsOut&&
      /^5\.00$/.test(String(x.text.override!=null?x.text.override:x.text.value)));
    if(!m) return {found:false};
    const u=m.dir;
    const S={tA:Math.min(D(m.measure.p1,u),D(m.measure.p2,u)),
             tB:Math.max(D(m.measure.p1,u),D(m.measure.p2,u))};
    const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
    h.setSelection(ids);
    const grip=h.dimModelGrips(P).find(g=>g.kind==='text');
    const mid=(S.tA+S.tB)/2, push=mid-D(grip.at,u);
    const A=h.W2S(grip.at[0],grip.at[1]);
    const B=h.W2S(grip.at[0]+u[0]*push, grip.at[1]+u[1]*push);
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
    st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    // inspect the drawn result
    const arrows=[]; let beyond=0;
    (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
      if(p._dim!==m.id || !/^dim/.test(p._role||'') || p.pts.length<2) return;
      const A2=p.pts.map(q=>[q[0]+(o.dx||0),q[1]+(o.dy||0)]);
      A2.forEach(q=>{ const t=D(q,u);
        if(t<S.tA-1e-6 || t>S.tB+1e-6) beyond++; });
      if(!p._arrow) return;
      const add=(tip,from)=>arrows.push({
        atA:Math.abs(D(tip,u)-S.tA)<1e-6, atB:Math.abs(D(tip,u)-S.tB)<1e-6,
        outward:Math.sign(D(tip,u)-D(from,u))});
      if(p._arrow.s) add(A2[0],A2[1]);
      if(p._arrow.e) add(A2[A2.length-1],A2[A2.length-2]);
    }));
    const g=h.dimGeomOf(m);
    return {found:true, id:m.id, value:g.text.str,
      spanMM:+(S.tB-S.tA).toFixed(2),
      valueWidthMM:+h.dimTextWidth(g.text.str,m.text.h).toFixed(2),
      arrowsOut:m.line.arrowsOut, stub:m.line.stub.map(x=>+x.toFixed(3)),
      arrowheads:arrows.length,
      tipsOnExtensionLines:arrows.filter(a=>a.atA||a.atB).length,
      pointingOutward:arrows.filter(a=>(a.atA&&a.outward<0)||(a.atB&&a.outward>0)).length,
      inkBeyondExtensionLines:beyond};
  });
  console.log(JSON.stringify(r));
  if(r.found){
    await pg.evaluate((id)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      const m=h.dimModelById(P,id), g=h.dimGeomOf(m);
      const u=m.dir,n=[-u[1],u[0]],D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const tA=Math.min(D(m.measure.p1,u),D(m.measure.p2,u));
      const tB=Math.max(D(m.measure.p1,u),D(m.measure.p2,u));
      const c=[u[0]*(tA+tB)/2+n[0]*m.line.q, u[1]*(tA+tB)/2+n[1]*m.line.q];
      h.zoomRect(c[0]-9,c[1]-9,c[0]+9,c[1]+9);
    }, r.id);
    await pg.waitForTimeout(300);
    fs.writeFileSync(require('./harness').out('tight.png'), await pg.locator('canvas').first().screenshot());
  }
  await b.close();
})();

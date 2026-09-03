const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(); const P=h.activePage();
    const st=document.getElementById('stage'); const rc=st.getBoundingClientRect();
    const bad=[]; let notb=[];
    (h.dimModels(P)||[]).filter(m=>m.ok).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const g=h.dimGeomOf(m); const seg=g.segs.find(s=>!s.hidden);
      const mid=[(seg.a[0]+seg.b[0])/2,(seg.a[1]+seg.b[1])/2];
      const s0=h.W2S(mid[0],mid[1]); const n=[-m.dir[1],m.dir[0]];
      const s1=h.W2S(mid[0]+n[0]*6, mid[1]+n[1]*6);
      const tb=h.store.pages.find(p=>p.id===h.store.activeId);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:rc.left+x,clientY:rc.top+y,button:0}));
      const q0=m.line.q;
      ev('mousedown',s0.x,s0.y); ev('mousemove',s1.x,s1.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      if(Math.abs(m.line.q-q0)<1e-6){ notb.push({id:m.id, sx:+s0.x.toFixed(0), sy:+s0.y.toFixed(0)}); return; }
      // check ext spans
      const D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const prims={}; (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{ if(p._dim===m.id&&p._role) prims[p._role]={p,o}; }));
      ['ext0','ext1'].forEach((r2,i)=>{ const e=prims[r2]; if(!e||e.p.pts.length<2) return;
        const qs=e.p.pts.map(pt=>D([pt[0]+(e.o.dx||0),pt[1]+(e.o.dy||0)],n));
        const lo=Math.min(...qs), hi=Math.max(...qs), q=m.line.q;
        const miss=(q<lo)?lo-q:(q>hi)?q-hi:0;
        if(miss>0.001) bad.push({id:m.id, side:i, miss:+miss.toFixed(2), q:+q.toFixed(2),
          qi:+D(i?m.measure.p2:m.measure.p1,n).toFixed(2), gap:+m.ext.gap[i].toFixed(2),
          over:+m.ext.overshoot[i].toFixed(2), dx:+(e.o.dx||0).toFixed(2), dy:+(e.o.dy||0).toFixed(2)});
      });
    });
    return {bad, notb};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();

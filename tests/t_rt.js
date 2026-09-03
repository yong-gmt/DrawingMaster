const {open,loadDxf}=require('./harness');
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.activePage();
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    let worst=0, n=0;
    (h.dimModels(P)||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
      const key=()=>{ const a=[]; (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim===m.id) a.push(...p.pts.flat().map(v=>v+0)); })); return a; };
      const before=key();
      for(let c=0;c<5;c++){
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id); h.setSelection(ids);
      const g=h.dimGeomOf(m);
      let sg=null,bl=-1; g.segs.forEach(s=>{ if(s.hidden||!s.a) return;
        const L=Math.hypot(s.b[0]-s.a[0], s.b[1]-s.a[1]); if(L>bl){bl=L;sg=s;} });
      // grab the LINE GRIP - a bare point on the line moves the whole dimension now
      const lg=h.dimModelGrips(P).filter(x=>x.kind==='line');
      const mid=lg.length? lg[0].at.slice()
                         : [sg.a[0]*0.75+sg.b[0]*0.25, sg.a[1]*0.75+sg.b[1]*0.25];
      const nv=[-m.dir[1],m.dir[0]];
      const A=h.W2S(mid[0],mid[1]); const B={x:A.x+12, y:A.y+12};
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:Math.round(rc.left+x),clientY:Math.round(rc.top+y),button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      // drag back to exactly where it started
      const g2=h.dimGeomOf(m);
      let sg2=null,b2=-1; g2.segs.forEach(s=>{ if(s.hidden||!s.a) return;
        const L=Math.hypot(s.b[0]-s.a[0], s.b[1]-s.a[1]); if(L>b2){b2=L;sg2=s;} });
      const lg2=h.dimModelGrips(P).filter(x=>x.kind==='line');
      const mid2=lg2.length? lg2[0].at.slice()
                           : [sg2.a[0]*0.75+sg2.b[0]*0.25, sg2.a[1]*0.75+sg2.b[1]*0.25];
      const C=h.W2S(mid2[0],mid2[1]); const D={x:C.x-12, y:C.y-12};
      ev('mousedown',C.x,C.y); ev('mousemove',D.x,D.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      }
      const after=key(); n++;
      for(let i=0;i<Math.min(before.length,after.length);i++) worst=Math.max(worst, Math.abs(before[i]-after[i]));
    });
    return {n, worstDriftMM:+worst.toFixed(6)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

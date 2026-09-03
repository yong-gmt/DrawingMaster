const {open,loadDxf}=require('./harness');
// Drag every dimension's value all over the place with real mouse events and check
// the gap to the line never budges from 4 px.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const PXMM=96/25.4;
    const c=document.createElement('canvas').getContext('2d');
    const inkGap=(m)=>{                       // gap from the line to the real ink
      const g=h.dimGeomOf(m); const hpx=m.text.h;
      c.font='100px '+h.store.format.font+',Arial';
      if(g.radial){ const land=g.segs.find(s=>s.role==='land');
        const ink=c.measureText(String(g.text.str));
        return (g.text.y-land.a[1]-Math.max(0,ink.actualBoundingBoxDescent)*m.text.h/100)*PXMM; }
      const u=m.dir, n=[-u[1],u[0]], D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      c.font='100px '+h.store.format.font+',Arial';
      const mt=c.measureText(String(g.text.str));
      const w=mt.width*hpx/100, asc=mt.actualBoundingBoxAscent*hpx/100, desc=Math.max(0,mt.actualBoundingBoxDescent)*hpx/100;
      const rr=(g.text.rot||0)*Math.PI/180;
      const right=[Math.cos(rr),Math.sin(rr)], up=[-Math.sin(rr),Math.cos(rr)];
      const A=[g.text.x,g.text.y];
      const qs=[[-w/2,-desc],[w/2,-desc],[-w/2,asc],[w/2,asc]]
        .map(([a2,b2])=>D([A[0]+right[0]*a2+up[0]*b2, A[1]+right[1]*a2+up[1]*b2], n));
      return Math.min(...qs.map(v=>Math.abs(v-m.line.q)))*PXMM;
    };
    const gaps=[]; let dragged=0, sideFlips=0;
    (P.dxf.dims||[]).filter(m=>m.ok).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(x=>x.kind==='text'||x.kind==='radial');
      if(!grip) return;
      const A=h.W2S(grip.at[0],grip.at[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      const side0=(m.text&&m.text.side)||0;
      // yank it in four different directions, well past the line
      [[40,55],[-70,-35],[25,-60],[-30,45]].forEach(([ox,oy])=>{
        ev('mousedown',A.x,A.y); ev('mousemove',A.x+ox,A.y+oy);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        gaps.push(+inkGap(m).toFixed(3));
      });
      if(m.text && m.text.side!==side0) sideFlips++;
      dragged++;
    });
    return {dragged, sideFlips, gapMin:Math.min(...gaps), gapMax:Math.max(...gaps)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

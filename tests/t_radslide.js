const {open,loadDxf}=require('./harness');
// Slide the value of every radius along its landing with real mouse events and
// check the landing still runs underneath the whole value, every time.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const PXMM=96/25.4;
    let moved=0, sideFlips=0, notCarried=0, gapBad=0, offArc=0, tried=0;
    const carried=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&m.kind==='radial').forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(g=>g.kind==='radial'); if(!grip) return;
      const A=h.W2S(grip.at[0],grip.at[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      const side0=m.land.side; const x0=h.dimGeomOf(m).text.x;
      [[70,0],[140,20],[-90,-15],[-160,10],[30,0]].forEach(([ox,oy])=>{
        ev('mousedown',A.x,A.y); ev('mousemove',A.x+ox,A.y+oy);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
        tried++;
        const g=h.dimGeomOf(m);
        const land=g.segs.find(s=>s.role==='land'), lead=g.segs.find(s=>s.role==='lead');
        const lo=Math.min(land.a[0],land.b[0]), hi=Math.max(land.a[0],land.b[0]);
        // does the landing run under the whole value?
        const tl=g.text.x-g.text.width/2, tr=g.text.x+g.text.width/2;
        if(tl<lo-1e-6 || tr>hi+1e-6) notCarried++;
        // is the value still at the locked gap above the landing?
        const cc=document.createElement('canvas').getContext('2d');
        cc.font='100px '+h.store.format.font+',Arial';
        const desc=Math.max(0,cc.measureText(String(g.text.str)).actualBoundingBoxDescent)*m.text.h/100;
        if(Math.abs((g.text.y-land.a[1]-desc)*PXMM-4)>0.01) gapBad++;
        // and does the arrow still touch the arc?
        offArc=Math.max(offArc, Math.abs(
          Math.hypot(lead.b[0]-m.centre[0], lead.b[1]-m.centre[1])-m.radius));
      });
      const g=h.dimGeomOf(m);
      if(Math.abs(g.text.x-x0)>0.5) moved++;
      if(m.land.side!==side0) sideFlips++;
      carried.push(+g.text.off.toFixed(2));
    });
    return {radials:carried.length, drags:tried, movedAlong:moved, sideFlips,
            landingNotUnderValue:notCarried, gapNot4px:gapBad,
            arrowOffArcMM:+offArc.toFixed(5)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

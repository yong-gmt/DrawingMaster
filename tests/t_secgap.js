const {open,loadDxf}=require('./harness');
// The clear space between the arrow tip and the letter's real ink must be 4 px,
// and it must stay 4 px however the marker is dragged about.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const PXMM=96/25.4;
    const c=document.createElement('canvas').getContext('2d');
    const measure=(s)=>{
      const g=h.secGeomOf(s), out=[];
      const texts=[]; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
        if(t._sec===s.id) texts.push([t.x+(o.dx||0), t.y+(o.dy||0), t.h, String(t.text)]); }));
      s.ends.forEach((E,k)=>{
        const tip=g.pts[k===0?0:3];
        let L=null,bd=1e9;
        texts.forEach(t=>{ const d=Math.hypot(t[0]-tip[0],t[1]-tip[1]); if(d<bd){bd=d;L=t;} });
        c.font='100px '+h.store.format.font+',Arial';
        const m=c.measureText(L[3]);
        const w=m.width*L[2]/100, asc=m.actualBoundingBoxAscent*L[2]/100,
              desc=Math.max(0,m.actualBoundingBoxDescent)*L[2]/100;
        // the four corners of the real ink box
        const corners=[[-w/2,-desc],[w/2,-desc],[-w/2,asc],[w/2,asc]]
          .map(([a,b])=>[L[0]+a, L[1]+b]);
        // nearest ink to the tip, measured along the viewing direction
        const near=Math.min(...corners.map(q=>(q[0]-tip[0])*E.view[0]+(q[1]-tip[1])*E.view[1]));
        out.push({h:+L[2].toFixed(2), gapPx:+(near*PXMM).toFixed(2)});
      });
      return out;
    };
    const first=(P.dxf.secs||[]).flatMap(measure);
    // now drag things about and measure again
    (P.dxf.secs||[]).forEach(s=>{
      const ids=(P.objects||[]).filter(o=>o._sec===s.id).map(o=>o.id);
      h.setSelection(ids);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      [['end',0,[20,20]],['leg',1,[-25,25]],['end',1,[-15,-15]]].forEach(([k,i,d])=>{
        const g=h.secGrips(P).find(x=>x.kind===k&&x.idx===i); if(!g) return;
        const A=h.W2S(g.at[0],g.at[1]);
        ev('mousedown',A.x,A.y); ev('mousemove',A.x+d[0],A.y+d[1]);
        st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      });
    });
    const after=(P.dxf.secs||[]).flatMap(measure);
    return {before:first, after};
  });
  console.log(JSON.stringify(r));
  const all=[...r.before,...r.after];
  console.log('gap always 4 px:', all.every(x=>Math.abs(x.gapPx-4)<0.05),
              ' letter size unchanged by dragging:',
              new Set(all.map(x=>x.h)).size===1);
  await b.close();
})();

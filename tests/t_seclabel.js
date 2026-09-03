const {open,loadDxf}=require('./harness');
// Drag a section end repeatedly and watch what happens to the letter.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  await pg.evaluate(()=>{ window.__hook().store.format.fontSize=9; });
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const s=(P.dxf.secs||[])[0];
    const ids=(P.objects||[]).filter(o=>o._sec===s.id).map(o=>o.id);
    h.setSelection(ids);
    const hs=()=>{ const out=[]; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(t=>{
      if(t._sec===s.id) out.push(+t.h.toFixed(2)); })); return out; };
    const u=h.secAxis(s), track=[hs()];
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    for(let k=0;k<4;k++){
      const g=h.secGrips(P).find(x=>x.kind==='end'&&x.idx===0);
      const A=h.W2S(g.at[0],g.at[1]);
      ev('mousedown',A.x,A.y); ev('mousemove',A.x+6,A.y+6);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      track.push(hs());
    }
    return {letterHeightAfterEachDrag:track};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();

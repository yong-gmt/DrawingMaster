const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const dims=(P.dxf.dims||[]).filter(m=>m.ok&&m.dir).slice(0,8);
    const click=(p)=>{ const s=h.W2S(p[0],p[1]);
      const ev=(t)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+s.x), clientY:Math.round(rc.top+s.y), button:0}));
      ev('mousedown'); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
    const dimOf=()=>{ const ids=[...h.selIds]; const o=ids.map(i=>h.objById(i)).filter(Boolean);
      const s=new Set(o.map(x=>x._dim)); return [...s].join('|'); };
    const log=[];
    dims.forEach(m=>{
      const g=h.dimGeomOf(m), sg=g.segs.find(s=>!s.hidden);
      const mid=[(sg.a[0]+sg.b[0])/2,(sg.a[1]+sg.b[1])/2];
      click(mid);
      log.push({want:m.id, got:dimOf(), n:h.selIds.size});
    });
    return log;
  });
  console.log(JSON.stringify(r,null,0));
  await b.close();
})();

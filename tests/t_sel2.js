const {open,loadDxf}=require('./harness');
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(dxf.includes('1')?require('./harness').APP:require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const click=(p)=>{ const s=h.W2S(p[0],p[1]);
      const ev=(t)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+s.x), clientY:Math.round(rc.top+s.y), button:0}));
      ev('mousedown'); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
    const cur=()=>{ const o=[...h.selIds].map(i=>h.objById(i)).filter(Boolean);
      return [...new Set(o.map(x=>x._dim||'(plain)'))].join('|')||'(none)'; };
    // one clickable point per dimension, of several kinds
    const pts=[];
    (P.dxf.dims||[]).filter(m=>m.ok).forEach(m=>{
      const g=h.dimGeomOf(m);
      const sg=g.segs.find(s=>!s.hidden && s.a);
      if(sg) pts.push({id:m.id, kind:g.radial?'radial-lead':'dim-line',
        p:[(sg.a[0]+sg.b[0])/2,(sg.a[1]+sg.b[1])/2]});
      if(g.ext&&g.ext[0]&&!g.ext[0].hidden)
        pts.push({id:m.id, kind:'ext', p:[(g.ext[0].a[0]+g.ext[0].b[0])/2,(g.ext[0].a[1]+g.ext[0].b[1])/2]});
      pts.push({id:m.id, kind:'text', p:[g.text.x, g.text.y]});
    });
    const fails=[];
    // click every point twice over, in order, and see whether selection follows
    for(let pass=0; pass<2; pass++)
      pts.forEach(pt=>{ const before=cur(); click(pt.p); const after=cur();
        if(after!==pt.id) fails.push({from:before, clicked:pt.id, kind:pt.kind, got:after}); });
    // The question that matters is not "does every pixel pick the right one" (two
    // dimensions can genuinely overlap) but "can every dimension be reached at all,
    // no matter what is selected first".
    const reachable=new Set();
    pts.forEach(pt=>{ click(pt.p); if(cur()===pt.id) reachable.add(pt.id); });
    const all=[...new Set(pts.map(p=>p.id))];
    return {tried:pts.length*2, nFails:fails.length,
      unreachable:all.filter(id=>!reachable.has(id)),
      fails:fails.slice(0,6)};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

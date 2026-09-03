const {open,loadDxf}=require('./harness');
// Find EVERY arrowhead-like thing near the round features, whoever owns it.
// A leftover the model does not know about will never show up in a test that only
// looks at what the model drew.
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const heads=[];
    (P.objects||[]).forEach(o=>{
      const dx=o.dx||0, dy=o.dy||0;
      (o.prims.polys||[]).forEach(p=>{
        const A=(p.pts||[]).map(q=>[q[0]+dx,q[1]+dy]);
        if(p._arrow&&A.length>=2){
          if(p._arrow.s) heads.push({src:'cap', dim:p._dim||null, sec:p._sec||null,
            role:p._role||null, at:A[0]});
          if(p._arrow.e) heads.push({src:'cap', dim:p._dim||null, sec:p._sec||null,
            role:p._role||null, at:A[A.length-1]});
        }
        // a closed 3-4 point outline is how some CADs draw an arrowhead
        if(A.length>=3 && A.length<=5 &&
           Math.hypot(A[0][0]-A[A.length-1][0], A[0][1]-A[A.length-1][1])<0.05){
          let mx=0; for(let i=0;i<A.length;i++) for(let j=i+1;j<A.length;j++)
            mx=Math.max(mx, Math.hypot(A[i][0]-A[j][0], A[i][1]-A[j][1]));
          if(mx<6) heads.push({src:'outline', dim:p._dim||null, sec:p._sec||null,
            role:p._role||null, at:A[0], size:+mx.toFixed(2)});
        }
      });
      (o.prims.solids||[]).forEach(s=>{
        let cx=0,cy=0; s.forEach(q=>{cx+=q[0]+dx;cy+=q[1]+dy;});
        heads.push({src:'solid', dim:s._dim||null, sec:s._sec||null,
          at:[cx/s.length, cy/s.length]});
      });
    });
    // which of them sit on a round feature, and does that feature's dimension own it?
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&(m.kind==='radial'||m.kind==='diameter')).forEach(m=>{
      const near=heads.filter(a=>Math.abs(
        Math.hypot(a.at[0]-m.centre[0], a.at[1]-m.centre[1])-m.radius)<1.5);
      out.push({id:m.id, r:+m.radius.toFixed(2),
        mine:near.filter(a=>a.dim===m.id).length,
        strangers:near.filter(a=>a.dim!==m.id).map(a=>({src:a.src, dim:a.dim, role:a.role}))});
    });
    return {totalHeads:heads.length, out};
  });
  console.log(JSON.stringify(r,null,1).slice(0,2600));
  await b.close();
})();

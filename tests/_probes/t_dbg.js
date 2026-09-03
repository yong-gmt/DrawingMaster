const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(); const P=h.store.pages.find(x=>x.id===h.store.activeId);
    const d=P.dxf;
    const res=[];
    ['dim1','dim2'].forEach(id=>{
      const m=d.dims.find(x=>x.id===id); if(!m) return;
      const raw=d.polys.filter(p=>p._dim===id).map(p=>p.pts);
      const u=m.dir, n=[-u[1],u[0]];
      const D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      res.push({id, kind:m.kind, dir:u.map(x=>+x.toFixed(3)),
        meas:[m.measure.p1.map(x=>+x.toFixed(2)),m.measure.p2.map(x=>+x.toFixed(2))],
        t:[+D(m.measure.p1,u).toFixed(2),+D(m.measure.p2,u).toFixed(2)],
        q:[+D(m.measure.p1,n).toFixed(2),+D(m.measure.p2,n).toFixed(2)], lineq:+m.line.q.toFixed(2),
        ext:JSON.parse(JSON.stringify(m.ext)), line:JSON.parse(JSON.stringify(m.line)),
        raw:raw.map(pp=>pp.map(p=>[+D(p,u).toFixed(2),+D(p,n).toFixed(2)]))});
    });
    return res;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();

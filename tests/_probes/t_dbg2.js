const {open,loadDxf}=require('./harness');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet1.dxf');
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const out=[];
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(g=>g.kind==='text');
      const u=m.dir,D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const t1=D(m.measure.p1,u), t2=D(m.measure.p2,u);
      const before={t:m.text.t, span:[+Math.min(t1,t2).toFixed(2),+Math.max(t1,t2).toFixed(2)]};
      const A=h.W2S(grip.at[0],grip.at[1]);
      const far=[grip.at[0]+u[0]*(Math.abs(t2-t1)+25), grip.at[1]+u[1]*(Math.abs(t2-t1)+25)];
      const B=h.W2S(far[0],far[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:Math.round(rc.left+x),clientY:Math.round(rc.top+y),button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      out.push({id:m.id, before, afterT:m.text.t==null?null:+m.text.t.toFixed(2),
        arrowsOut:m.line.arrowsOut, stub:m.line.stub.map(v=>+v.toFixed(2)),
        gripAt:[+A.x.toFixed(0),+A.y.toFixed(0)], to:[+B.x.toFixed(0),+B.y.toFixed(0)]});
    });
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();

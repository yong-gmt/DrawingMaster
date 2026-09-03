const {open,loadDxf}=require('./harness');
// The form change is only real if the ARROWS actually turn round. Measure the
// direction each drawn arrowhead points, before and after the value is dragged
// out past the extension line.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    // which way does each arrowhead point, in the dimension's own frame?
    // key each arrowhead by WHERE its tip is, so we compare like with like
    const dirs=(m)=>{
      const u=m.dir, D=(p,v)=>p[0]*v[0]+p[1]*v[1], out={};
      const add=(tip,from)=>{ out[D(tip,u).toFixed(1)]=Math.sign(D(tip,u)-D(from,u)); };
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id || !p._arrow || p.pts.length<2) return;
        const dx=o.dx||0, dy=o.dy||0;
        const A=p.pts.map(q=>[q[0]+dx,q[1]+dy]);
        if(p._arrow.s) add(A[0], A[1]);
        if(p._arrow.e) add(A[A.length-1], A[A.length-2]);
      }));
      return out;
    };
    let n=0, turned=0, bothOut=0, stubGrew=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir&&!m.line.arrowsOut).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(g=>g.kind==='text'); if(!grip) return;
      n++;
      const before=dirs(m);
      const u=m.dir, D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const tB=Math.max(D(m.measure.p1,u), D(m.measure.p2,u));
      const push=tB-D(grip.at,u)+14;
      const A=h.W2S(grip.at[0],grip.at[1]);
      const B=h.W2S(grip.at[0]+u[0]*push, grip.at[1]+u[1]*push);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const after=dirs(m);
      // at each tip position that exists in both, the direction must have reversed
      const keys=Object.keys(before).filter(k=>k in after);
      if(keys.length && keys.every(k=>before[k]===-after[k])) turned++;
      if(m.line.arrowsOut) bothOut++;
      if((m.line.stub[0]||0)+(m.line.stub[1]||0)>0.01) stubGrew++;
      // before: arrows point outward = "-1,1"; after: inward = "-1,1" too, but on
      // stubs - so also record the raw strings for the first few
      if(n<=2) console.log(m.id,'before',JSON.stringify(before),'after',JSON.stringify(after));
    });
    return {n, arrowsReversedAtSameTip:turned, wentOutsideForm:bothOut, lineJoggedOut:stubGrew};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

const {open,loadDxf}=require('./harness');
// The other direction: a dimension that ARRIVED in the outside form (arrows out,
// a jog carrying the value). Drag the value back in between the extension lines:
// the outside piece must be cut away and the arrows must turn back in.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const D=(p,v)=>p[0]*v[0]+p[1]*v[1];
    const tipDirs=(m)=>{ const u=m.dir, out={};
      const add=(tip,from)=>{ out[D(tip,u).toFixed(1)]=Math.sign(D(tip,u)-D(from,u)); };
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id||!p._arrow||p.pts.length<2) return;
        const A=p.pts.map(q=>[q[0]+(o.dx||0),q[1]+(o.dy||0)]);
        if(p._arrow.s) add(A[0],A[1]);
        if(p._arrow.e) add(A[A.length-1],A[A.length-2]);
      })); return out; };
    const drawnSpan=(m)=>{ const u=m.dir; let lo=1e9, hi=-1e9;
      (P.objects||[]).forEach(o=>(o.prims.polys||[]).forEach(p=>{
        if(p._dim!==m.id||!/^dim/.test(p._role||'')||p.pts.length<2) return;
        p.pts.forEach(q=>{ const t=D([q[0]+(o.dx||0),q[1]+(o.dy||0)],u); lo=Math.min(lo,t); hi=Math.max(hi,t); });
      })); return [lo,hi]; };
    const drag=(m,from,toT)=>{
      const u=m.dir;
      const push=toT-D(from,u);
      const A=h.W2S(from[0],from[1]);
      const B=h.W2S(from[0]+u[0]*push, from[1]+u[1]*push);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    };
    let roomy=0, wentInside=0, outsideCut=0, arrowsTurnedIn=0, fitted=0;
    let narrow=0, narrowStayedOut=0, narrowCarried=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
      const u=m.dir, S={tA:Math.min(D(m.measure.p1,u),D(m.measure.p2,u)),
                        tB:Math.max(D(m.measure.p1,u),D(m.measure.p2,u))};
      const w=h.dimTextWidth((m.text.override!=null?m.text.override:m.text.value), m.text.h);
      const hasRoom=((S.tB-S.tA) >= w);          // the value fits between them
      const mid=(S.tA+S.tB)/2;
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      let grip=h.dimModelGrips(P).find(g=>g.kind==='text'); if(!grip) return;
      // put the value OUTSIDE first, so we start from the outside form
      drag(m, grip.at, S.tB + w/2 + 10);
      if(!m.line.arrowsOut) return;                    // never got outside: skip
      const before=tipDirs(m);
      grip=h.dimModelGrips(P).find(g=>g.kind==='text');
      // now drag it back in between the extension lines
      drag(m, grip.at, mid);
      const after=tipDirs(m), span=drawnSpan(m), g=h.dimGeomOf(m);
      if(hasRoom){
        roomy++;
        if(!m.line.arrowsOut) wentInside++;
        if(span[0]>=S.tA-1e-6 && span[1]<=S.tB+1e-6) outsideCut++;
        const keys=Object.keys(before).filter(k=>k in after);
        if(keys.length && keys.every(k=>before[k]===-after[k])) arrowsTurnedIn++;
        if(Math.abs(g.text.t-mid)<0.6) fitted++;
      }else{
        // no room: the standard says it must STAY outside, still carried by a line
        narrow++;
        if(m.line.arrowsOut) narrowStayedOut++;
        const tl=g.text.t-w/2, tr=g.text.t+w/2;
        if(span[0]<=tl+1e-6 && span[1]>=tr-1e-6) narrowCarried++;
      }
    });
    return {roomy, switchedToInside:wentInside, outsidePieceRemoved:outsideCut,
            arrowsTurnedRound:arrowsTurnedIn, valueLandedAtCentre:fitted,
            narrow, narrowStayedOutside:narrowStayedOut, narrowStillCarried:narrowCarried};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

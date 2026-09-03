const {open,loadDxf}=require('./harness');
// Drag the value out past an extension line: the arrows must flip outward and the
// dimension line must jog out to carry it. Drag back in: it must return.
(async()=>{
 for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,dxf);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    let flipped=0, carried=0, returned=0, sideChanged=0, n=0;
    (P.dxf.dims||[]).filter(m=>m.ok&&m.dir).forEach(m=>{
      const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
      h.setSelection(ids);
      const grip=h.dimModelGrips(P).find(g=>g.kind==='text'); if(!grip) return;
      n++;
      const u=m.dir, D=(p,v)=>p[0]*v[0]+p[1]*v[1];
      const S={t1:D(m.measure.p1,u), t2:D(m.measure.p2,u)};
      const tB=Math.max(S.t1,S.t2);
      const out0=!!m.line.arrowsOut, side0=m.text.side;
      const A=h.W2S(grip.at[0],grip.at[1]);
      // aim well past the far extension line, along the dimension line
      const target=[grip.at[0]+u[0]*(tB-D(grip.at,u)+14), grip.at[1]+u[1]*(tB-D(grip.at,u)+14)];
      const B=h.W2S(target[0],target[1]);
      const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
        clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
      ev('mousedown',A.x,A.y); ev('mousemove',B.x,B.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const g=h.dimGeomOf(m);
      if(m.line.arrowsOut) flipped++;
      // is there dimension line under the value now?
      const tl=g.text.t-h.dimTextWidth(g.text.str, m.text.h)/2;
      const tr=g.text.t+h.dimTextWidth(g.text.str, m.text.h)/2;
      const covered=g.segs.some(s=>{ if(s.hidden||!s.a) return false;
        const a=D(s.a,u), bb=D(s.b,u);
        return Math.min(a,bb)<=tl+1e-6 && Math.max(a,bb)>=tr-1e-6; });
      if(covered) carried++;
      if(m.text.side!==side0) sideChanged++;
      // drag it home again
      const g2=h.dimGeomOf(m); const A2=h.W2S(g2.text.x,g2.text.y);
      const mid=[(S.t1+S.t2)/2];
      const home=[u[0]*mid[0]+(g2.text.x-u[0]*D([g2.text.x,g2.text.y],u)),
                  u[1]*mid[0]+(g2.text.y-u[1]*D([g2.text.x,g2.text.y],u))];
      const C=h.W2S(home[0],home[1]);
      ev('mousedown',A2.x,A2.y); ev('mousemove',C.x,C.y);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      // "home" now means the form that SUITS the value, not the form the file
      // happened to arrive with - a roomy dimension that arrived jogged comes back
      // to the inside form, which is the point of the change.
      const u2=m.dir, wv=h.dimTextWidth(g.text.str, m.text.h);
      const roomy=(Math.abs(S.t2-S.t1) >= wv);   // the value fits between them
      if(m.line.arrowsOut === (roomy? false : true)) returned++;
    });
    return {n, flippedToOutside:flipped, valueCarriedByLine:carried,
            cameHomeToTheRightForm:returned, sideChanged};
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

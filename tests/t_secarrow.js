const {open,loadDxf}=require('./harness');
// After STYLIZE a section marker must be the ONLY thing on its own line: one
// polyline with arrow caps, and nothing of the original arrowheads left behind -
// whatever shape the file drew them as (filled triangle, or closed outline).
(async()=>{
 for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
  const {b,pg}=await open('DrawingMaster.html');
  await loadDxf(pg,dxf);
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(600);
  const r=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const out=[];
    (P.dxf.secs||[]).filter(s=>s.ok).forEach(s=>{
      const g=h.secGeomOf(s);
      const A=g.pts[1], B=g.pts[2];
      const L=Math.hypot(B[0]-A[0],B[1]-A[1])||1;
      const u=[(B[0]-A[0])/L,(B[1]-A[1])/L], n=[-u[1],u[0]];
      const near=(q)=>{
        const t=(q[0]-A[0])*u[0]+(q[1]-A[1])*u[1];
        const d=Math.abs((q[0]-A[0])*n[0]+(q[1]-A[1])*n[1]);
        /* the marker's own strip, not the whole neighbourhood: a dimension arrow
           standing 8 mm off the cut is somebody else's annotation, correctly so */
        return d<4 && t>-12 && t<L+12;
      };
      let strayArrowShapes=0, strayFilled=0, mine=0, dashOnCut=null;
      (P.objects||[]).forEach(o=>{
        const dx=o.dx||0, dy=o.dy||0;
        (o.prims.polys||[]).forEach(p=>{
          const A2=(p.pts||[]).map(q=>[q[0]+dx,q[1]+dy]);
          if(p._sec===s.id){ mine++; if(dashOnCut===null && A2.length>=4) dashOnCut=p.dash||0; return; }
          if(A2.length<3 || A2.length>6) return;
          // a small closed shape sitting on the marker is a leftover arrowhead
          const closed=Math.hypot(A2[0][0]-A2[A2.length-1][0], A2[0][1]-A2[A2.length-1][1])<0.05;
          if(!closed) return;
          let span=0;
          for(let i=0;i<A2.length;i++) for(let j=i+1;j<A2.length;j++)
            span=Math.max(span, Math.hypot(A2[i][0]-A2[j][0], A2[i][1]-A2[j][1]));
          if(span<7 && A2.some(near)) strayArrowShapes++;
        });
        (o.prims.solids||[]).forEach(sd=>{
          const q=[sd.reduce((a,c)=>a+c[0],0)/sd.length+dx, sd.reduce((a,c)=>a+c[1],0)/sd.length+dy];
          if(sd._sec!==s.id && near(q)) strayFilled++;
        });
      });
      out.push({id:s.id, drawnByModel:mine,
                leftoverArrowOutlines:strayArrowShapes, leftoverFilledArrows:strayFilled,
                cutLineDash:dashOnCut});
    });
    return out;
  });
  console.log(dxf, JSON.stringify(r));
  await b.close();
 }
})();

const {chromium}=require('./_pw');
const path=require('path');
// Moving things after an import: a plain line, a whole dimension, a section
// marker, a balloon, and a marquee selection of several at once.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+require('./harness').fixture(require('./harness').APP)); await p.waitForTimeout(800);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(1600);
  const r=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    const drag=(from,ddx,ddy)=>{ const A=h.W2S(from[0],from[1]);
      ev('mousedown',A.x,A.y); ev('mousemove',A.x+ddx*0.4,A.y+ddy*0.4);
      ev('mousemove',A.x+ddx,A.y+ddy);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); };
    const out={};

    // 1. a whole dimension: select it, then drag it by its own dimension line
    const m=(P.dxf.dims||[]).find(x=>x.ok && x.dir);
    const ids=(P.objects||[]).filter(o=>o._dim===m.id).map(o=>o.id);
    h.setSelection(ids);
    const g=h.dimGeomOf(m), seg=g.segs.find(s=>!s.hidden && s.a);
    // grab a point ON the dimension but AWAY from every grip square, the way a
    // person grabs something to move it
    const grips=h.dimModelGrips(P);
    let grab=null;
    for(let f=0.05; f<=0.95; f+=0.05){
      const q=[seg.a[0]+(seg.b[0]-seg.a[0])*f, seg.a[1]+(seg.b[1]-seg.a[1])*f];
      if(grips.every(gr=>Math.hypot(gr.at[0]-q[0], gr.at[1]-q[1])>2.5)){ grab=q; break; }
    }
    out.foundAGripFreeSpotOnTheDimension=!!grab;
    const q0=m.line.q, p1=m.measure.p1.slice();
    if(grab) drag(grab, 70, 50);
    // the click may land on a neighbour that overlaps the grab point, so ask
    // whether ANY part of this dimension moved, not one particular primitive
    out.dimension={ objectMoved:(P.objects||[]).some(o=>o._dim===m.id && ((o.dx||0)||(o.dy||0))),
      anythingMoved:(P.objects||[]).filter(o=>(o.dx||0)||(o.dy||0)).length,
      measuredPointMoved:+Math.hypot(m.measure.p1[0]-p1[0], m.measure.p1[1]-p1[1]).toFixed(2),
      dimensionLineShifted:+Math.abs(m.line.q-q0).toFixed(2) };

    // 2. a marquee over a patch of the part, then drag the lot
    h.setSelection([]);
    const A=h.W2S(70,100), B=h.W2S(115,145);
    ev('mousedown',A.x,A.y); ev('mousemove',(A.x+B.x)/2,(A.y+B.y)/2);
    ev('mousemove',B.x,B.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    out.marquee={picked:[...h.selIds].length};
    if(h.selIds.size){
      const before=(P.objects||[]).filter(o=>h.selIds.has(o.id)).map(o=>[o.dx||0,o.dy||0]);
      // start the drag ON one of the objects that was just selected, not on blank
      // paper - grabbing empty space starts a new marquee, as it should
      const sel=(P.objects||[]).find(o=>h.selIds.has(o.id) &&
        (o.prims.polys||[]).some(q=>q.pts.length>=2));
      const pl=sel.prims.polys.find(q=>q.pts.length>=2);
      const on=[(pl.pts[0][0]+pl.pts[1][0])/2+(sel.dx||0),
                (pl.pts[0][1]+pl.pts[1][1])/2+(sel.dy||0)];
      drag(on, 80, 60);
      const after=(P.objects||[]).filter(o=>h.selIds.has(o.id)).map(o=>[o.dx||0,o.dy||0]);
      out.marquee.allMoved=before.every((v,i)=>after[i][0]!==v[0]||after[i][1]!==v[1]);
      out.marquee.howManyMoved=after.filter(v=>v[0]||v[1]).length+'/'+after.length;
    }
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  console.log('errors:', errs.length, errs.slice(0,3));
  await b.close();
})();

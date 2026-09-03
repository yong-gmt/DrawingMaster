const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// With several objects selected, a Shift-drag must hold the CENTRE of the whole
// selection on its line - and must behave the same however large the selection
// is, because only the centre is being followed.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', H.fixture('Head-back.dxf'));
  await p.waitForTimeout(1900);

  /* Choose the selection directly instead of marqueeing: a marquee can miss, and
     a grab point can land on a neighbour that is NOT in the selection - Shift then
     ADDS that neighbour, which moves the centre for a perfectly good reason and
     makes the measurement lie. The grab point is checked to be on a selected
     object before the drag starts. */
  const run=async(count, ddx, ddy)=>{
    const at=await p.evaluate((count)=>{
      const hk=window.__hook(), P=hk.store.pages.find(x=>x.id===hk.store.activeId);
      (P.objects||[]).forEach(o=>{ o.dx=0; o.dy=0; });
      const plain=(P.objects||[]).filter(o=>!o._dim&&!o._sec&&!o._bal&&
        (o.prims.polys||[]).some(q=>q.pts.length>=2));
      const pick=plain.slice(0, count);
      hk.setSelection(pick.map(o=>o.id)); hk.render();
      // a point on one of the selected objects that no other object sits on
      for(const o of pick){
        for(const pl of o.prims.polys){
          if(pl.pts.length<2) continue;
          // and clear of the panels down the left, or the click never reaches the canvas
          const m=[(pl.pts[0][0]+pl.pts[1][0])/2+(o.dx||0),
                   (pl.pts[0][1]+pl.pts[1][1])/2+(o.dy||0)];
          const hit=hk.objAtPoint(m[0],m[1]);
          if(hit && hk.selIds.has(hit.id)){
            const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
            const A=hk.W2S(m[0],m[1]);
            if(A.x<340 || A.y<40 || A.x>rc.width-40 || A.y>rc.height-60) continue;
            const bb=hk.selectionBBox();
            return {x:rc.left+A.x, y:rc.top+A.y, n:[...hk.selIds].length,
                    cx:+((bb.minx+bb.maxx)/2).toFixed(3), cy:+((bb.miny+bb.maxy)/2).toFixed(3),
                    w:+(bb.maxx-bb.minx).toFixed(1), h:+(bb.maxy-bb.miny).toFixed(1)};
          }
        }
      }
      return null;
    }, count);
    if(!at) return {picked:0};
    await p.keyboard.down('Shift');
    await p.mouse.move(at.x,at.y); await p.mouse.down();
    await p.mouse.move(at.x+ddx*0.4, at.y+ddy*0.4);
    await p.mouse.move(at.x+ddx, at.y+ddy);
    await p.mouse.up(); await p.keyboard.up('Shift');
    await p.waitForTimeout(250);
    const after=await p.evaluate(()=>{
      const hk=window.__hook(); const bb=hk.selectionBBox();
      return {n:[...hk.selIds].length,
              cx:+((bb.minx+bb.maxx)/2).toFixed(3), cy:+((bb.miny+bb.maxy)/2).toFixed(3)};
    });
    return {picked:at.n, stillPicked:after.n, sizeMM:at.w+'x'+at.h,
            movedCx:+(after.cx-at.cx).toFixed(3), movedCy:+(after.cy-at.cy).toFixed(3)};
  };

  for(const [n,label] of [[3,'3 objects'],[40,'40 objects'],[200,'200 objects']]){
    const across=await run(n,140,60);
    const down  =await run(n,50,150);
    console.log(label.padEnd(12), 'selection', (across.sizeMM||'-').padEnd(14),
      '| sideways: centre x', String(across.movedCx).padStart(8), 'y', across.movedCy,
      '| down: centre x', down.movedCx, 'y', String(down.movedCy).padStart(8));
    const reallyMoved=Math.abs(across.movedCx)>1 && Math.abs(down.movedCy)>1;
    console.log(' '.repeat(12), '  actually moved:', reallyMoved,
      ' · y held while sideways:', across.movedCy===0,
      ' · x held while down:', down.movedCx===0,
      ' · selection unchanged:', across.picked===across.stillPicked);
  }
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();

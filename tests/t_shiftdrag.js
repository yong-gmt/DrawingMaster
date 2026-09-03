const {chromium}=require('./_pw');
const APP=require('./harness').APP;
// Holding Shift while dragging must keep the move on one axis - and stay there
// even when the smart snapping would like to pull it sideways.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(500);
  await p.click('#btnImport');
  await p.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await p.waitForTimeout(1800);

  const grab=async()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const o=(P.objects||[]).find(x=>!x._dim&&!x._sec&&!x._bal&&
      (x.prims.polys||[]).some(q=>q.pts.length>=2));
    const pl=o.prims.polys.find(q=>q.pts.length>=2);
    const m=[(pl.pts[0][0]+pl.pts[1][0])/2+(o.dx||0),(pl.pts[0][1]+pl.pts[1][1])/2+(o.dy||0)];
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(m[0],m[1]); window.__id=o.id;
    return {x:rc.left+A.x, y:rc.top+A.y};
  });
  /* The click may land on a neighbour that overlaps the grab point, so ask what
     MOVED rather than what I guessed would move. */
  const moved=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.objects||[]).filter(o=>(o.dx||0)||(o.dy||0));
    if(!m.length) return {dx:0, dy:0, count:0};
    return {dx:+(m[0].dx||0).toFixed(3), dy:+(m[0].dy||0).toFixed(3), count:m.length};
  });
  const reset=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    (P.objects||[]).forEach(o=>{ o.dx=0; o.dy=0; }); h.render();
  });

  /* shift can be held BEFORE the drag starts or pressed part-way through - both
     are how people do it, and on mousedown Shift also means "add to selection",
     so the two must not fight. */
  const drag=async(dx,dy,shift,early)=>{
    await reset();
    const at=await grab();
    if(shift && early) await p.keyboard.down('Shift');
    await p.mouse.move(at.x, at.y); await p.mouse.down();
    if(shift && !early) await p.keyboard.down('Shift');
    await p.mouse.move(at.x+dx*0.4, at.y+dy*0.4);
    await p.mouse.move(at.x+dx, at.y+dy);
    await p.mouse.up();
    if(shift) await p.keyboard.up('Shift');
    await p.waitForTimeout(200);
    return moved();
  };

  const free  = await drag(120, 70, false);
  const lockX = await drag(120, 70, true);          // pressed after the drag began
  const lockY = await drag(40, 130, true);
  const early = await drag(120, 70, true, true);    // held down before clicking
  console.log('no shift, dragged 120x70 :', JSON.stringify(free),
              '  (both axes move)');
  console.log('shift,   dragged 120x70  :', JSON.stringify(lockX),
              '  vertical held at zero:', lockY!==null && lockX.dy===0);
  console.log('shift,   dragged 40x130  :', JSON.stringify(lockY),
              '  horizontal held at zero:', lockY.dx===0);
  console.log('and it still moves along the locked axis:',
              Math.abs(lockX.dx)>1 && Math.abs(lockY.dy)>1);
  console.log('shift held BEFORE the click:', JSON.stringify(early),
              ' locked:', early.dy===0 && Math.abs(early.dx)>1);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();

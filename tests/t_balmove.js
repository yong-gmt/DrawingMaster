const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
// A balloon added after others must be its own thing: draggable on its own, and
// deletable without taking a neighbour with it.
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
  for(let i=0;i<3;i++){ await H.addBalloon(p); await p.waitForTimeout(700); }

  const where=()=>p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.dxf.balloons||[]).map(m=>({id:m.id, num:m.num,
      c:m.c.map(v=>+v.toFixed(2)), tip:m.tip.map(v=>+v.toFixed(2))}));
  });
  const a=await where();
  console.log('three balloons:', JSON.stringify(a.map(x=>x.id+'#'+x.num)));

  // drag the SECOND one by its circle grip
  const moved=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.balloons||[])[1];
    h.setSelection((P.objects||[]).filter(o=>o._bal===m.id).map(o=>o.id));
    const g=h.balGrips(P).find(x=>x.kind==='balC');
    if(!g) return 'no grip';
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(g.at[0],g.at[1]);
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    ev('mousedown',A.x,A.y); ev('mousemove',A.x-70,A.y+55);
    st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    return 'ok';
  });
  const c=await where();
  const movedOnly = c.filter((x,i)=>JSON.stringify(x.c)!==JSON.stringify(a[i].c)).map(x=>x.id);
  console.log('dragged the second     :', moved, '| balloons that moved:', JSON.stringify(movedOnly));

  /* Drag the THIRD one by its ring - a body drag, not a grip drag - and ask the
     STROKES where they went, not the model. The model always agreed with itself:
     it once ran right off the sheet while the circle on the page never moved a
     pixel, and a test that only read m.c called that a pass. */
  const body=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.balloons||[])[2];
    h.setSelection((P.objects||[]).filter(o=>o._bal===m.id).map(o=>o.id));
    const ring=(P.objects||[]).find(o=>(o.prims.polys||[]).some(q=>q._role==='ring'&&q._bal===m.id));
    const rp=ring.prims.polys.find(q=>q._role==='ring');
    const at=[rp.pts[0][0]+(ring.dx||0), rp.pts[0][1]+(ring.dy||0)];   // a point ON the circle
    const before={ c:m.c.slice(), stroke:at.slice() };
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(at[0],at[1]);
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    ev('mousedown',A.x,A.y);
    for(let i=1;i<=6;i++) ev('mousemove', A.x+i*8, A.y-i*6);
    st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    h.render();
    const m2=(P.dxf.balloons||[]).find(x=>x.id===m.id);
    const ring2=(P.objects||[]).find(o=>(o.prims.polys||[]).some(q=>q._role==='ring'&&q._bal===m.id));
    const rp2=ring2.prims.polys.find(q=>q._role==='ring');
    const at2=[rp2.pts[0][0]+(ring2.dx||0), rp2.pts[0][1]+(ring2.dy||0)];
    return { model:[+(m2.c[0]-before.c[0]).toFixed(2), +(m2.c[1]-before.c[1]).toFixed(2)],
             stroke:[+(at2[0]-before.stroke[0]).toFixed(2), +(at2[1]-before.stroke[1]).toFixed(2)] };
  });
  const agree = Math.abs(body.model[0]-body.stroke[0])<0.01 && Math.abs(body.model[1]-body.stroke[1])<0.01;
  console.log('dragged by the ring    : model moved', JSON.stringify(body.model),
              '| strokes moved', JSON.stringify(body.stroke),
              '| they agree:', agree,
              '| it actually moved:', (Math.abs(body.stroke[0])+Math.abs(body.stroke[1]))>1);

  // delete the first, through the same path the keyboard uses
  await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=(P.dxf.balloons||[])[0];
    h.setSelection((P.objects||[]).filter(o=>o._bal===m.id).map(o=>o.id));
  });
  await p.keyboard.press('Delete'); await p.waitForTimeout(500);
  const d=await where();
  console.log('after deleting the first:', JSON.stringify(d.map(x=>x.id)),
              '| the moved one kept its place:',
              JSON.stringify((d.find(x=>x.id===c[1].id)||{}).c)===JSON.stringify(c[1].c));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();

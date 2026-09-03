const {chromium}=require('./_pw');
const path=require('path');
// Import a drawing, select something, drag it. Does it move?
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
    // pick a plain object line and click the middle of it
    const o=(P.objects||[]).find(o=>!o._dim && !o._sec && !o._bal &&
      (o.prims.polys||[]).some(q=>q.pts.length>=2));
    const pl=o.prims.polys.find(q=>q.pts.length>=2);
    const a=pl.pts[0], c=pl.pts[pl.pts.length-1];
    const mid=[(a[0]+c[0])/2+(o.dx||0), (a[1]+c[1])/2+(o.dy||0)];
    const A=h.W2S(mid[0],mid[1]);
    ev('mousedown',A.x,A.y); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    const picked=[...h.selIds];
    // now drag it 60 px right, 40 px down
    ev('mousedown',A.x,A.y);
    ev('mousemove',A.x+20,A.y+14);
    ev('mousemove',A.x+60,A.y+40);
    st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
    const moved=(P.objects||[]).filter(x=>(x.dx||0)!==0 || (x.dy||0)!==0);
    return {clickSelected:picked.length, objectsThatMoved:moved.length,
            dx:moved[0]? +moved[0].dx.toFixed(2):0, dy:moved[0]? +moved[0].dy.toFixed(2):0};
  });
  console.log(JSON.stringify(r));
  console.log('errors:', errs.length, errs.slice(0,3));
  await b.close();
})();

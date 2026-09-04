const {chromium}=require('../_pw');
const H=require('../harness'), APP=H.APP;
const fs=require('fs'), path=require('path');
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
const pars=()=>{ const h=window.__hook();
  const pg=h.store.pages.find(x=>x.type==='sheet');
  return h.parPolys(pg).map(p=>p.pts.map(q=>[q[0],q[1]])); };
const r2=v=>+v.toFixed(2);
const fmt=a=>a.map(p=>`[${r2(p[0][0])},${r2(p[0][1])}]-[${r2(p[1][0])},${r2(p[1][1])}]`).join('  ');
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:1500,height:950}});
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(800);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(600);

  // the menu
  await p.click('#btnSpecial'); await p.waitForTimeout(300);
  console.log('menu items: '+await p.evaluate(()=>[...document.querySelectorAll('#specialMenu .ctx-item')]
    .map(i=>i.textContent.trim()+(i.querySelector('svg')?' [icon]':' [NO ICON]')).join(' | ')));
  fs.writeFileSync(path.join(OUT,'ui_special_menu.png'), await p.screenshot({clip:{x:850,y:40,width:640,height:210}}));
  await p.click('#specialMenu [data-x="partition"]'); await p.waitForTimeout(700);
  console.log('after 1 add   : '+fmt(await p.evaluate(pars)));

  // a second and a third, each clear of the last
  for(let i=0;i<2;i++){ await p.click('#btnSpecial'); await p.waitForTimeout(250);
    await p.click('#specialMenu [data-x="partition"]'); await p.waitForTimeout(600); }
  console.log('after 3 adds  : '+fmt(await p.evaluate(pars)));

  // drag the right-hand end of the newest one: first sideways, then far upward
  const S=async(wx,wy)=>{ const c=await p.evaluate(([x,y])=>{ const q=window.__hook().W2S(x,y);
      const r=document.getElementById('stage').getBoundingClientRect();
      return {x:r.left+q.x, y:r.top+q.y}; },[wx,wy]); return c; };
  let list=await p.evaluate(pars); let last=list[list.length-1];
  let a=await S(last[1][0], last[1][1]);
  let t=await S(last[1][0]+40, last[1][1]+3);           // mostly sideways
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(t.x,t.y,{steps:8}); await p.mouse.up();
  await p.waitForTimeout(400);
  list=await p.evaluate(pars); last=list[list.length-1];
  console.log('stretched H   : '+fmt([last])+'  horizontal='+(last[0][1]===last[1][1]));

  // press the middle grip: the line turns ninety degrees about its centre
  const midBefore=[(last[0][0]+last[1][0])/2, (last[0][1]+last[1][1])/2];
  const lenBefore=Math.hypot(last[1][0]-last[0][0], last[1][1]-last[0][1]);
  a=await S(midBefore[0], midBefore[1]);
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(500);
  list=await p.evaluate(pars); last=list[list.length-1];
  const midAfter=[(last[0][0]+last[1][0])/2, (last[0][1]+last[1][1])/2];
  const lenAfter=Math.hypot(last[1][0]-last[0][0], last[1][1]-last[0][1]);
  console.log('turned        : '+fmt([last])
    +'  vertical='+(Math.abs(last[0][0]-last[1][0])<1e-6)
    +'  centre kept='+(Math.abs(midAfter[0]-midBefore[0])<0.01 && Math.abs(midAfter[1]-midBefore[1])<0.01)
    +'  length kept='+(Math.abs(lenAfter-lenBefore)<0.05));

  // and a vertical one still stretches only vertically
  a=await S(last[1][0], last[1][1]);
  t=await S(last[1][0]+9, last[1][1]+25);
  await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(t.x,t.y,{steps:8}); await p.mouse.up();
  await p.waitForTimeout(400);
  list=await p.evaluate(pars); last=list[list.length-1];
  console.log('stretched V   : '+fmt([last])+'  vertical='+(Math.abs(last[0][0]-last[1][0])<1e-6));

  const before=JSON.stringify(await p.evaluate(pars));
  fs.writeFileSync(path.join(OUT,'ui_partition.png'), await p.locator('#stage').screenshot());

  // the returning user: reload, reopen the project, nothing may move
  await p.reload(); await p.waitForTimeout(1400);
  const card=await p.$('.proj-card, .pc'); if(card) await card.click();
  await p.waitForTimeout(1200);
  const after=JSON.stringify(await p.evaluate(pars));
  console.log('after reload  : '+fmt(JSON.parse(after)));
  /* the question is whether anything MOVED, so compare in millimetres - the store
     writes coordinates to four decimals, which is a ten-thousandth of a mm */
  const A=JSON.parse(before), B=JSON.parse(after);
  let worst=-1;
  if(A.length!==B.length) worst=Infinity;
  else A.forEach((ln,i)=>ln.forEach((pt,j)=>pt.forEach((v,k)=>{
    worst=Math.max(worst, Math.abs(v-B[i][j][k])); })));
  console.log('lines kept    : '+A.length+' of '+A.length+'   worst shift = '+worst.toFixed(4)+' mm');

  // drawn on the sheet, and at the frame's weight
  const drawn=await p.evaluate(()=>{ const h=window.__hook();
    const pg=h.store.pages.find(x=>x.type==='sheet');
    const objs=(pg.objects||[]).filter(o=>(o.prims.polys||[]).some(q=>q._par));
    return {objects:objs.length, frameLw:objs.every(o=>o.prims.polys[0]._frameLw===true)}; });
  console.log('objects/weight: '+JSON.stringify(drawn));
  if(errs.length) console.log('PAGE ERRORS: '+errs.join(' | '));
  await b.close();
})();

const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
const diff=async(a,b)=>{
  const A=await sharp(a).raw().toBuffer({resolveWithObject:true});
  const B=await sharp(b).raw().toBuffer({resolveWithObject:true});
  let n=0; const {width,height,channels}=A.info;
  for(let i=0;i<width*height;i++){ let d=0;
    for(let c=0;c<3;c++) d=Math.max(d,Math.abs(A.data[i*channels+c]-B.data[i*channels+c]));
    if(d>60) n++; }
  return n;
};
// Grouping on import is no longer automatic, so ONE click selects ONE stroke.
// To move a lot of the drawing you marquee it first - that is the manual path,
// and this checks the manual path works.
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
  await p.waitForTimeout(2000);
  const info=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const g={};
    // count only real groups; ungrouped strokes are not "one big group"
    (P.objects||[]).forEach(o=>{ if(o.group) (g[o.group]||(g[o.group]=[])).push(o.id); });
    return {objects:(P.objects||[]).length, groups:Object.keys(g).length,
            ungrouped:(P.objects||[]).filter(o=>!o.group).length,
            largestGroup:Math.max(0,...Object.values(g).map(a=>a.length))};
  });
  console.log('after import:', JSON.stringify(info));

  const at=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // a stroke of the part itself, not a dimension
    const o=(P.objects||[]).find(x=>!x._dim&&!x._sec&&!x._bal&&
      (x.prims.polys||[]).some(q=>q.pts.length>=2));
    const pl=o.prims.polys.find(q=>q.pts.length>=2);
    const m=[(pl.pts[0][0]+pl.pts[1][0])/2+(o.dx||0),(pl.pts[0][1]+pl.pts[1][1])/2+(o.dy||0)];
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(m[0],m[1]);
    return {x:rc.left+A.x, y:rc.top+A.y};
  });
  // one click selects one stroke, because nothing was grouped for us
  await p.mouse.move(at.x, at.y); await p.mouse.down(); await p.mouse.up();
  await p.waitForTimeout(250);
  const one=await p.evaluate(()=>[...window.__hook().selIds].length);
  console.log('one click selects:', one, 'object(s)');

  // now the manual path: marquee a region, then drag what was caught
  const box=await p.evaluate(()=>{ const h=window.__hook();
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(55,95), B=h.W2S(120,180);
    return {x0:rc.left+A.x, y0:rc.top+A.y, x1:rc.left+B.x, y1:rc.top+B.y}; });
  await p.mouse.move(box.x0, box.y0); await p.mouse.down();
  await p.mouse.move((box.x0+box.x1)/2, (box.y0+box.y1)/2);
  await p.mouse.move(box.x1, box.y1); await p.mouse.up();
  await p.waitForTimeout(300);
  const sel=await p.evaluate(()=>[...window.__hook().selIds].length);
  console.log('a marquee selected:', sel, 'objects');
  // drag from a point that IS on one of them
  Object.assign(at, await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const o=(P.objects||[]).find(x=>h.selIds.has(x.id) &&
      (x.prims.polys||[]).some(q=>q.pts.length>=2));
    const pl=o.prims.polys.find(q=>q.pts.length>=2);
    const m=[(pl.pts[0][0]+pl.pts[1][0])/2+(o.dx||0),(pl.pts[0][1]+pl.pts[1][1])/2+(o.dy||0)];
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const A=h.W2S(m[0],m[1]); return {x:rc.left+A.x, y:rc.top+A.y}; }));

  fs.writeFileSync('bk_a.png', await p.locator('canvas').first().screenshot());
  await p.mouse.move(at.x, at.y); await p.mouse.down();
  await p.mouse.move(at.x+50, at.y+35);
  await p.mouse.move(at.x+110, at.y+75);
  await p.mouse.up(); await p.waitForTimeout(300);
  fs.writeFileSync('bk_b.png', await p.locator('canvas').first().screenshot());
  const moved=await p.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return (P.objects||[]).filter(o=>(o.dx||0)||(o.dy||0)).length; });
  console.log('objects that moved:', moved, '| pixels changed:', await diff('bk_a.png','bk_b.png'));
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();

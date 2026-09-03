const {chromium}=require('./_pw');
const APP=require('./harness').APP;
const fs=require('fs'), path=require('path'), sharp=require('sharp');
const OUT=path.join(require('./harness').ROOT,'tests','out');
fs.mkdirSync(OUT,{recursive:true});
// The flags can all match and the drawing still look different, so compare the
// PICTURE: after STYLIZE, and after leaving and coming back.
/* Compare the DRAWING, not the window. The toast that says what STYLIZE did is
   still on screen in the first shot and gone in the second, and the selection
   toolbar changes too - counting those said 20,000 pixels had moved when the
   drawing itself had not moved at all. */
/* Start to the right of the sidebar: the page row shows a delete icon once it has
   been clicked, which is 71 pixels of chrome that has nothing to do with the
   drawing - and was the whole of the "difference" this test used to report. */
const CROP={left:340, top:20, width:940, height:640};
const diff=async(a,b)=>{
  const A=await sharp(a).extract(CROP).raw().toBuffer({resolveWithObject:true});
  const B=await sharp(b).extract(CROP).raw().toBuffer({resolveWithObject:true});
  let n=0; const {width,height,channels}=A.info;
  for(let i=0;i<width*height;i++){ let d=0;
    for(let c=0;c<3;c++) d=Math.max(d,Math.abs(A.data[i*channels+c]-B.data[i*channels+c]));
    if(d>60) n++; }
  return n;
};
(async()=>{
  const b=await chromium.launch();
  for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const ctx=await b.newContext({viewport:{width:1400,height:900}});
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
    await p.goto('file://'+APP); await p.waitForTimeout(900);
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(500);
    await p.click('#btnImport');
    await p.setInputFiles('#fileInput', require('./harness').fixture(dxf));
    await p.waitForTimeout(1900);
    await p.click('#btnStylize'); await p.waitForTimeout(1000);
    const fit=()=>p.evaluate(()=>{ const h=window.__hook();
      const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });
    await p.evaluate(()=>{ const h=window.__hook(); h.setSelection([]); h.render(); });
    await fit(); await p.waitForTimeout(400);
    const A=path.join(OUT,'ps_a.png');
    fs.writeFileSync(A, await p.locator('canvas').first().screenshot());
    await p.waitForTimeout(3600);            // let the toast fade before comparing

    // drop the selection first: its floating toolbar is chrome, not drawing
    await p.evaluate(()=>{ const h=window.__hook(); h.setSelection([]); h.render(); });
    await p.waitForTimeout(300);
    const back=await p.$('#btnBack'); if(back && await back.isVisible()) await back.click();
    await p.waitForTimeout(900);
    const card=await p.$('text=Project 1');
    if(card){ await card.click(); await p.waitForTimeout(1600);
      const s2=await p.$('text=Sheet 01'); if(s2&&await s2.isVisible()) await s2.click();
      await p.waitForTimeout(900); }
    await fit(); await p.waitForTimeout(400);
    const B=path.join(OUT,'ps_b.png');
    fs.writeFileSync(B, await p.locator('canvas').first().screenshot());

    console.log(dxf, '| pixels that changed by leaving and coming back:',
                await diff(A,B), '| errors:', errs.length);
    await ctx.close();
  }
  await b.close();
})();

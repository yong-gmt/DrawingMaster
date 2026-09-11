const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs');
const sharp=require('sharp');
// "Bold" has to be visible, not just a flag. Draw the same words with and without
// it and compare how much ink each one puts down.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}});
  const page=await ctx.newPage();
  await page.goto('file://'+require('./harness').fixture(require('./harness').APP));
  await page.waitForTimeout(800);
  await page.evaluate(()=>window.__hook().createProject());
  await page.waitForTimeout(600);
  const sh=await page.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await page.waitForTimeout(500);
  // This container substitutes a single face for Arial, so asking for weight 700
  // changes almost nothing and the measurement would say more about the machine
  // than about the code. Use a family that really has a bold face installed.
  await page.evaluate(()=>{ window.__hook().store.format.font='DejaVu Sans'; });
  // Put ONE label on an otherwise empty sheet and count the ink over the whole
  // canvas, so the measurement cannot be thrown off by where a crop box landed.
  const shot=async(bold)=>{
    await page.evaluate((bold)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      P.dxf={polys:[],texts:[],solids:[],marks:[],hatches:[],clines:[],dims:[],secs:[]};
      P.objects=[{id:'o1', dx:0, dy:0, group:null,
        prims:{polys:[],solids:[],marks:[],hatches:[],clines:[],
          texts:[{text:'SECTION A-A', x:105, y:150, h:8, rot:0, align:1,
                  bold:bold, _user:true}]}}];
      h.render();
    }, bold);
    await page.waitForTimeout(400);
    const png=await page.locator('canvas').first().screenshot();
    fs.writeFileSync(require('./harness').out('bold_'+bold+'.png'), png);
    const im=await sharp(png).raw().toBuffer({resolveWithObject:true});
    let n=0; const {width,height,channels}=im.info;
    for(let i=0;i<width*height;i++) if(im.data[i*channels]<140) n++;
    return n;
  };
  const plain=await shot(false), bold=await shot(true);
  // the sheet frame and title block are drawn too, so subtract that baseline to
  // compare the LABEL's ink rather than the whole page's
  const blank=await page.evaluate(async()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    P.objects=[]; h.render(); return true; });
  await page.waitForTimeout(300);
  const bg=await (async()=>{ const png=await page.locator('canvas').first().screenshot();
    const im=await sharp(png).raw().toBuffer({resolveWithObject:true});
    let n=0; const {width,height,channels}=im.info;
    for(let i=0;i<width*height;i++) if(im.data[i*channels]<140) n++; return n; })();
  const p0=plain-bg, b0=bold-bg;
  console.log('ink in the label only - plain:', p0, ' bold:', b0,
              ' | bold is heavier:', b0>p0*1.15,
              ' (+'+Math.round((b0/p0-1)*100)+'%)');
  await b.close();
})();

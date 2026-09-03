const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs'), sharp=require('sharp');
const H=require('./harness'), APP=H.APP;
const BASE=path.join(H.ROOT,'src','base.html');   // the reader that changes nothing
const OUT=path.join(H.ROOT,'tests','out'); fs.mkdirSync(OUT,{recursive:true});
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
// Import must SHOW THE FILE. src/base.html is the version that does no restyling
// at all, so it is the reference for what the file looks like.
(async()=>{
  const b=await chromium.launch();
  const shoot=async(app, dxf, stylize)=>{
    const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
    await p.goto('file://'+app); await p.waitForTimeout(900);
    await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
    const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
    await p.waitForTimeout(500);
    await p.click('#btnImport');
    await p.setInputFiles('#fileInput', H.fixture(dxf));
    await p.waitForTimeout(1900);
    if(stylize){ await p.click('#btnStylize'); await p.waitForTimeout(1000); }
    await p.evaluate(()=>{ const h=window.__hook();
      h.setSelection([]);
      const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });
    await p.waitForTimeout(3800);           // let the toast fade
    const f=path.join(OUT, 'imp_'+(stylize?'sty':'raw')+'_'+dxf+'.png');
    fs.writeFileSync(f, await p.locator('canvas').first().screenshot());
    await p.context().close();
    return f;
  };
  for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const plain=await shoot(BASE, dxf, false);
    const mine =await shoot(APP,  dxf, false);
    const styled=await shoot(APP, dxf, true);
    console.log(dxf);
    console.log('  import differs from the plain reader by:', await diff(plain, mine), 'pixels');
    console.log('  STYLIZE then changes                  :', await diff(mine, styled), 'pixels');
  }
  await b.close();
})();

const _p=require('path');
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
// Import must SHOW THE FILE, not a rebuilt version of it. The old build did no
// rebuilding at all, so it is the reference for what the file looks like.
(async()=>{
  const b=await chromium.launch();
  const shots={};
  for(const [tag,file] of [['old',_p.join(require('./harness').ROOT,'src','base.html')],['new',require('./harness').APP]]){
    for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
      const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
      await p.goto('file://'+require('./harness').fixture(file)); await p.waitForTimeout(800);
      await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(600);
      const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
      await p.waitForTimeout(500);
      await p.click('#btnImport');
      await p.setInputFiles('#fileInput', require('./harness').fixture(dxf));
      await p.waitForTimeout(1800);
      await p.evaluate(()=>{ const h=window.__hook();
        const P=h.store.pages.find(x=>x.id===h.store.activeId);
        const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy); });
      await p.waitForTimeout(400);
      const f='imp_'+tag+'_'+dxf+'.png';
      fs.writeFileSync(f, await p.locator('canvas').first().screenshot());
      shots[tag+'|'+dxf]=f;
      if(tag==='new'){
        await p.click('#btnStylize'); await p.waitForTimeout(900);
        const g='sty_'+dxf+'.png';
        fs.writeFileSync(g, await p.locator('canvas').first().screenshot());
        shots['sty|'+dxf]=g;
      }
      await p.context().close();
    }
  }
  for(const dxf of ['Head-back.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const asImported=await diff(shots['old|'+dxf], shots['new|'+dxf]);
    const afterStylize=await diff(shots['new|'+dxf], shots['sty|'+dxf]);
    console.log(dxf);
    console.log('  import differs from the plain reader by:', asImported, 'pixels',
                asImported<3000? '(looks like the file)' : '(IMPORT IS CHANGING THE DRAWING)');
    console.log('  STYLIZE then changes            :', afterStylize, 'pixels');
  }
  await b.close();
})();

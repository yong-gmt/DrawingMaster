const {chromium}=require('./_pw');
const H=require('./harness'), APP=H.APP;
const sharp=require('sharp');
// The title block carries the supplied artwork: the projection symbol from its
// SVG, and the logo image filling its cell. Both are checked by looking at the
// pixels in their own cells - a drawing routine that silently does nothing leaves
// a blank cell, and no count of function calls would show it.
(async()=>{
  const b=await chromium.launch();
  const p=await (await b.newContext({viewport:{width:1400,height:900},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  await p.goto('file://'+APP); await p.waitForTimeout(900);
  await p.evaluate(()=>window.__hook().createProject()); await p.waitForTimeout(700);
  const sh=await p.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await p.waitForTimeout(1200);
  const cells=await p.evaluate(()=>{
    const h=window.__hook(), t=h.tbRect();
    h.zoomRect(t.x-3, t.y-3, t.x+185, t.y+45); h.render();
    return true;
  });
  await p.waitForTimeout(900);
  const png=await p.locator('canvas').first().screenshot();
  const im=await sharp(png).raw().toBuffer({resolveWithObject:true});
  const {width,height,channels}=im.info;
  const box=(x0,y0,x1,y1)=>{
    let ink=0, colour=0, n=0;
    for(let y=Math.round(y0*height); y<Math.round(y1*height); y++)
      for(let x=Math.round(x0*width); x<Math.round(x1*width); x++){
        const i=(y*width+x)*channels, R=im.data[i], G=im.data[i+1], B=im.data[i+2];
        n++;
        if(R<160 && G<160 && B<160) ink++;
        if(Math.abs(R-B)>25 || Math.abs(G-B)>25) colour++;   // not black or grey
      }
    return {inkPct:+(100*ink/n).toFixed(1), colouredPct:+(100*colour/n).toFixed(1)};
  };
  const proj=box(0.36,0.50,0.47,0.60);
  const logo=box(0.80,0.46,0.92,0.62);
  console.log('projection cell:', JSON.stringify(proj));
  console.log('logo cell      :', JSON.stringify(logo));
  console.log('  the symbol is drawn      :', proj.inkPct>2);
  console.log('  the logo is drawn        :', logo.inkPct>2);
  console.log('  the logo is in colour    :', logo.colouredPct>1);
  // the slider handle wears the app's blue
  await p.click('#btnFormat'); await p.waitForTimeout(800);
  const thumb=await p.evaluate(()=>{
    const css=[...document.styleSheets].flatMap(s=>{ try{ return [...s.cssRules]; }catch(e){ return []; } })
      .map(r=>r.cssText).filter(t=>/slider-thumb|range-thumb/.test(t)).join(' ');
    return {rule:css.slice(0,200),
            accent:getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()};
  });
  console.log('  slider handle uses --ink :', /var\(--ink\)/.test(thumb.rule),
              '· --ink is', thumb.accent);
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();

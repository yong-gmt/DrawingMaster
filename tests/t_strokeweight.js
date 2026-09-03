const {open,loadDxf}=require('./harness');
const sharp=require('sharp');
// The Stroke Weight setting must move BOTH the object lines and the dimension
// lines. Measured as ink on the canvas with the view pinned, and with only one
// kind of line on the page at a time so neither can hide the other.
(async()=>{
  const {b,pg}=await open('DrawingMaster.html');
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await loadDxf(pg,'Head-back.dxf');
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(1100);
  // pin the view once, so nothing but the line width can change the picture
  await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    window.__all=P.objects;
    const bb=h.entitiesBBox(P); h.zoomRect(bb.minx,bb.miny,bb.maxx,bb.maxy);
    h.setSelection([]);
  });
  const show=(what)=>pg.evaluate((what)=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    P.objects=window.__all.filter(o=> what==='dimension' ? !!o._dim : (!o._dim && !o._sec));
    h.render();
  }, what);
  const ink=async()=>{
    const png=await pg.locator('canvas').first().screenshot();
    const im=await sharp(png).raw().toBuffer({resolveWithObject:true});
    let n=0; const {width,height,channels}=im.info;
    /* Count SOLID ink. A hairline is drawn as a wide band of pale grey, so a
       generous threshold made the thinnest setting look like the heaviest. */
    for(let i=0;i<width*height;i++) if(im.data[i*channels]<90) n++;
    return n;
  };
  for(const what of ['object','dimension']){
    await show(what);
    /* an array, not an object: JavaScript reorders number-like keys and the
       readings came out scrambled */
    /* one throwaway reading first: the very first screenshot after swapping the
       object list caught the canvas mid-redraw and read high */
    await pg.evaluate(()=>{ window.__hook().store.format.stroke=0.05; window.__hook().render(); });
    await pg.waitForTimeout(400); await ink();
    const steps=[0.05,0.2,0.5,1.0], out=[];
    for(const w of steps){
      await pg.evaluate((w)=>{ window.__hook().store.format.stroke=w; window.__hook().render(); }, w);
      await pg.waitForTimeout(300);
      out.push(await ink());
    }
    const vals=out;
    const rising=vals.every((v,i)=>i===0 || v>=vals[i-1]);
    console.log(what.padEnd(10), steps.map((w,i)=>w+'mm:'+vals[i]).join('  '),
      '| thicker every step:', rising,
      '| 0.05 -> 1.0 mm:', (vals[3]/vals[0]).toFixed(2)+'x');
  }
  console.log('errors:', errs.length, errs.slice(0,2));
  await b.close();
})();

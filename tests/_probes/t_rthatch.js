const {open,loadDxf}=require('./harness');
const fs=require('fs');
const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
// Does the exported file still show the section fill? Measure the ink inside a
// hatched region in both, rather than squinting at it.
(async()=>{
  const shots={};
  for(const [tag,file,sty] of [['a','Body_Demo_Drawing_Sheet3.dxf',true],
                               ['b','rt_Body_Demo_Drawing_Sheet3.dxf',false]]){
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,file);
    if(sty) await pg.evaluate(()=>document.querySelector('#btnStylize').click());
    const box=await pg.evaluate((known)=>{
      const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
      let a=1e9,b2=1e9,c=-1e9,d=-1e9;
      (P.dxf.hatches||[]).forEach(ht=>ht.loops.forEach(L=>L.forEach(p=>{
        a=Math.min(a,p[0]); b2=Math.min(b2,p[1]); c=Math.max(c,p[0]); d=Math.max(d,p[1]); })));
      // the exported file has no HATCH entity any more - the pattern left as
      // strokes - so measure the very same patch of the drawing in both
      if(a>1e8 && known){ [a,b2,c,d]=known; }
      if(a>1e8) return null;
      window.__box=[a,b2,c,d];
      h.zoomRect(a-1,b2-1,c+1,d+1);
      const S=(x,y)=>{const q=h.W2S(x,y); return [q.x,q.y];};
      const A=S(a,d), B=S(c,b2);
      return {left:Math.round(A[0]), top:Math.round(A[1]),
              width:Math.round(B[0]-A[0]), height:Math.round(B[1]-A[1])};
    }, global.__known||null);
    global.__known=await pg.evaluate(()=>window.__box);
    await pg.waitForTimeout(400);
    const png='rh_'+tag+'.png';
    fs.writeFileSync(png, await pg.locator('canvas').first().screenshot());
    shots[tag]={png, box};
    await b.close();
  }
  for(const t of ['a','b']){
    const {png,box}=shots[t];
    if(!box){ console.log(t,'no hatch found'); continue; }
    const im=await sharp(png).extract(box).raw().toBuffer({resolveWithObject:true});
    let n=0; const {width,height,channels}=im.info;
    for(let i=0;i<width*height;i++) if(im.data[i*channels]<140) n++;
    console.log(t==='a'?'in the app        ':'in the exported file',
                'ink inside the hatched area:', (100*n/(width*height)).toFixed(2)+'%');
  }
})();

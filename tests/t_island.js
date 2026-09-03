const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
// The hole in a hatched region must stay empty, and the ring around it must not.
(async()=>{
 for(const [tag,file] of [['old',_p.join(require('./harness').ROOT,'src','base.html')],['new',require('./harness').APP]]){
  const {b,pg}=await open(file);
  await loadDxf(pg,'hatch_test.dxf');
  const box=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const ht=(P.dxf.hatches||[]).find(x=>x.loops.length===2);
    const bb=(L)=>{ let a=1e9,b2=1e9,c=-1e9,d=-1e9;
      L.forEach(p=>{a=Math.min(a,p[0]);b2=Math.min(b2,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]);});
      return {a,b:b2,c,d}; };
    const O=bb(ht.loops[0]), I=bb(ht.loops[1]);
    h.zoomRect(O.a-2,O.b-2,O.c+2,O.d+2);
    const S=(x,y)=>{ const q=h.W2S(x,y); return [q.x,q.y]; };
    const p=(x0,y0,x1,y1)=>{ const A=S(x0,y1), B=S(x1,y0);
      return {left:Math.round(A[0]), top:Math.round(A[1]),
              width:Math.round(B[0]-A[0]), height:Math.round(B[1]-A[1])}; };
    return { hole:p(I.a+1.5,I.b+1.5,I.c-1.5,I.d-1.5),
             ring:p(O.a+1.5,O.b+1.5,O.c-1.5,I.b-1.5) };
  });
  await pg.waitForTimeout(400);
  fs.writeFileSync('is_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  const ink=async(r)=>{ const im=await sharp('is_'+tag+'.png').extract(r).raw()
      .toBuffer({resolveWithObject:true});
    let n=0; const {width,height,channels}=im.info;
    for(let i=0;i<width*height;i++) if(im.data[i*channels]<140) n++;
    return +(100*n/(width*height)).toFixed(2); };
  console.log(tag, JSON.stringify({inkInHolePct:await ink(box.hole),
                                   inkInHatchedRingPct:await ink(box.ring)}));
  await b.close();
 }
})();

const _p=require('path');
const {open,loadDxf}=require('./harness');
const fs=require('fs');
// Two separate regions hatched with the SAME pattern and the same base point must
// come out on one continuous family of lines. Measured from the pixels: take a
// scanline across both, find where the hatch lines cross it, and compare the phase.
(async()=>{
 for(const [tag,file] of [['old',_p.join(require('./harness').ROOT,'src','base.html')],['new',require('./harness').APP]]){
  const {b,pg}=await open(file);
  await loadDxf(pg,'hatch_test.dxf');
  const info=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    // the two side-by-side ANSI31 rectangles from the test file
    const hs=(P.dxf.hatches||[]).filter(x=>x.pattern==='ANSI31' && x.loops.length===1);
    const bb=(ht)=>{ let a=1e9,b2=1e9,c=-1e9,d=-1e9;
      ht.loops[0].forEach(p=>{a=Math.min(a,p[0]);b2=Math.min(b2,p[1]);c=Math.max(c,p[0]);d=Math.max(d,p[1]);});
      return {a,b:b2,c,d}; };
    const A=bb(hs[0]), B=bb(hs[1]);
    const yMid=(A.b+A.d)/2;
    h.zoomRect(Math.min(A.a,B.a)-2, Math.min(A.b,B.b)-2, Math.max(A.c,B.c)+2, Math.max(A.d,B.d)+2);
    const s=(x,y)=>{ const q=h.W2S(x,y); return [q.x,q.y]; };
    return { scanY:s(A.a,yMid)[1],
             ax0:s(A.a+1,yMid)[0], ax1:s(A.c-1,yMid)[0],
             bx0:s(B.a+1,yMid)[0], bx1:s(B.c-1,yMid)[0],
             spacingPx:Math.abs(s(0,0)[0]-s(3.175*Math.SQRT2,0)[0]) };
  });
  await pg.waitForTimeout(400);
  fs.writeFileSync('al_'+tag+'.png', await pg.locator('canvas').first().screenshot());
  fs.writeFileSync('al_'+tag+'.json', JSON.stringify(info));
  await b.close();
 }
 const sharp=require('/home/claude/.npm-global/lib/node_modules/sharp');
 for(const tag of ['old','new']){
   const info=JSON.parse(fs.readFileSync('al_'+tag+'.json'));
   const img=await sharp('al_'+tag+'.png').raw().toBuffer({resolveWithObject:true});
   const {width,channels}=img.info;
   const row=Math.round(info.scanY);
   const dark=(x)=>{ const i=(row*width+Math.round(x))*channels; return img.data[i]<140; };
   const hits=(x0,x1)=>{ const out=[]; let run=null;
     for(let x=Math.ceil(x0); x<=Math.floor(x1); x++){
       if(dark(x)){ if(run===null) run=x; }
       else if(run!==null){ out.push((run+x-1)/2); run=null; } }
     return out; };
   const A=hits(info.ax0,info.ax1), B=hits(info.bx0,info.bx1);
   const sp=info.spacingPx;
   const phase=(arr)=>{ // mean phase of the crossings, modulo the spacing
     let sx=0, sy=0; arr.forEach(v=>{ const a=2*Math.PI*(v/sp); sx+=Math.cos(a); sy+=Math.sin(a); });
     return ((Math.atan2(sy,sx)/(2*Math.PI))*sp+sp)%sp; };
   const d=Math.abs(phase(A)-phase(B));
   console.log(tag, JSON.stringify({linesInA:A.length, linesInB:B.length,
     spacingPx:+sp.toFixed(2),
     phaseMismatchPx:+Math.min(d, sp-d).toFixed(2)}));
 }
})();

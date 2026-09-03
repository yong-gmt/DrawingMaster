const {open,loadDxf}=require('./harness');
const fs=require('fs');
(async()=>{
  const {b,pg}=await open(require('./harness').APP);
  await loadDxf(pg,'Body_Demo_Drawing_Sheet3.dxf');
  // zoom onto one narrow-gap dimension (arrows outside + jog carrying the value)
  const info=await pg.evaluate(()=>{
    const h=window.__hook(), P=h.activePage();
    const m=(h.dimModels(P)||[]).filter(x=>x.ok && x.line.arrowsOut && (x.line.stub[0]>3||x.line.stub[1]>3))[0];
    const g=h.dimGeomOf(m);
    const xs=[],ys=[]; g.ext.concat(g.segs).forEach(s=>{ if(s.hidden)return; xs.push(s.a[0],s.b[0]); ys.push(s.a[1],s.b[1]); });
    xs.push(g.text.x); ys.push(g.text.y);
    h.zoomRect(Math.min(...xs)-6, Math.min(...ys)-6, Math.max(...xs)+6, Math.max(...ys)+6);
    return {id:m.id, val:g.text.str, stub:m.line.stub};
  });
  await pg.waitForTimeout(300);
  fs.writeFileSync('look_1_import.png', await pg.locator('canvas').first().screenshot());
  await pg.evaluate(()=>document.querySelector('#btnStylize').click());
  await pg.waitForTimeout(300);
  fs.writeFileSync('look_2_stylize.png', await pg.locator('canvas').first().screenshot());
  await pg.evaluate((id)=>{
    const h=window.__hook(), P=h.activePage(); const m=h.dimModelById(P,id);
    const ids=(P.objects||[]).filter(o=>o._dim===id).map(o=>o.id); h.setSelection(ids);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const g=h.dimGeomOf(m), sg=g.segs.find(s=>!s.hidden);
    const mid=[(sg.a[0]+sg.b[0])/2,(sg.a[1]+sg.b[1])/2];
    const A=h.W2S(mid[0],mid[1]);
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:Math.round(rc.left+x),clientY:Math.round(rc.top+y),button:0}));
    ev('mousedown',A.x,A.y); ev('mousemove',A.x+30,A.y+30); st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  }, info.id);
  await pg.waitForTimeout(300);
  fs.writeFileSync('look_3_dragged.png', await pg.locator('canvas').first().screenshot());
  console.log(JSON.stringify(info));
  await b.close();
})();

const _fs=require('fs'), _p=require('path');
const OUTDIR=_p.join(require('./harness').ROOT,'tests','out');
_fs.mkdirSync(OUTDIR,{recursive:true});
/* files a test writes go here, never into the fixture folders */
function OUT(n){ return _p.join(OUTDIR, _p.basename(n)); }
const {chromium}=require('./_pw');
const path=require('path'), fs=require('fs'), {execSync}=require('child_process');
// Add balloons through the real button, edit a number, drag both ends, and check
// the result on the canvas and in the exported file.
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:900}, acceptDownloads:true});
  const page=await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  await page.goto('file://'+require('./harness').fixture(require('./harness').APP));
  await page.waitForTimeout(800);
  const nb=await page.$('#btnNew'); if(nb&&await nb.isVisible()) await nb.click();
  else await page.evaluate(()=>window.__hook().createProject());
  await page.waitForTimeout(600);
  const sh=await page.$('text=Sheet 01'); if(sh&&await sh.isVisible()) await sh.click();
  await page.waitForTimeout(500);
  await page.click('#btnImport');
  await page.setInputFiles('#fileInput', require('./harness').fixture('Head-back.dxf'));
  await page.waitForTimeout(1500);

  console.log('button on the toolbar :', await page.evaluate(()=>!!document.querySelector('#btnBalloon')));
  await page.click('#btnBalloon'); await page.waitForTimeout(400);
  await page.click('#btnBalloon'); await page.waitForTimeout(400);
  const made=await page.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    return h.balModels(P).map(m=>({id:m.id, num:m.num,
      c:m.c.map(v=>+v.toFixed(1)), tip:m.tip.map(v=>+v.toFixed(1))}));
  });
  console.log('two presses gave     :', JSON.stringify(made));

  // the parts each one is drawn from
  const parts=await page.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=h.balModels(P)[0];
    const out={ring:0, lead:0, num:0, arrowsOnLead:0};
    (P.objects||[]).forEach(o=>{
      (o.prims.polys||[]).forEach(p=>{ if(p._bal!==m.id) return;
        if(p._role==='ring') out.ring++;
        if(p._role==='lead'){ out.lead++; if(p._arrow&&p._arrow.e) out.arrowsOnLead++; } });
      (o.prims.texts||[]).forEach(t=>{ if(t._bal===m.id) out.num++; }); });
    return out;
  });
  console.log('one balloon is made of:', JSON.stringify(parts));

  // change the number to something wider and check the circle grows
  const grew=await page.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const m=h.balModels(P)[0];
    const before=h.balGeomOf(m).r;
    let t=null; (P.objects||[]).forEach(o=>(o.prims.texts||[]).forEach(x=>{ if(x._bal===m.id) t=x; }));
    t.text='12'; h.balSyncFromText? h.balSyncFromText(P,t) : null;
    return {before:+before.toFixed(2), after:+h.balGeomOf(m).r.toFixed(2), num:m.num};
  });
  console.log('number "1" -> "12"    :', JSON.stringify(grew));

  // drag the tip, then the circle, with real mouse events
  const dragged=await page.evaluate(()=>{
    const h=window.__hook(), P=h.store.pages.find(x=>x.id===h.store.activeId);
    const st=document.getElementById('stage'), rc=st.getBoundingClientRect();
    const ev=(t,x,y)=>st.dispatchEvent(new MouseEvent(t,{bubbles:true,
      clientX:Math.round(rc.left+x), clientY:Math.round(rc.top+y), button:0}));
    const m=h.balModels(P)[0];
    const ids=(P.objects||[]).filter(o=>o._bal===m.id).map(o=>o.id);
    h.setSelection(ids);
    const out={};
    const pull=(kind, ddx, ddy)=>{
      const g=h.balGrips(P).find(x=>x.kind===kind);
      if(!g) return 'no grip';
      const A=h.W2S(g.at[0],g.at[1]);
      ev('mousedown',A.x,A.y); ev('mousemove',A.x+ddx,A.y+ddy);
      st.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
      const w=h.S2W(A.x+ddx, A.y+ddy);
      const gg=h.balGeomOf(m), seg=gg.segs[0];
      const target=(kind==='balTip')? m.tip : m.c;
      return { followedCursorMM:+Math.hypot(target[0]-w.x, target[1]-w.y).toFixed(3),
        leaderStartsOnTheCircle:+Math.abs(Math.hypot(seg.a[0]-m.c[0], seg.a[1]-m.c[1])-gg.r).toFixed(4),
        leaderEndsAtTheTip:+Math.hypot(seg.b[0]-m.tip[0], seg.b[1]-m.tip[1]).toFixed(4),
        leaderMM:+Math.hypot(seg.b[0]-seg.a[0], seg.b[1]-seg.a[1]).toFixed(1) };
    };
    out.dragTip=pull('balTip', 120, 80);
    out.dragCircle=pull('balC', -90, -60);
    return out;
  });
  console.log('dragging the tip      :', JSON.stringify(dragged.dragTip));
  console.log('dragging the circle   :', JSON.stringify(dragged.dragCircle));

  await page.click('#btnStylize'); await page.waitForTimeout(800);
  fs.writeFileSync('balloon.png', await page.locator('canvas').first().screenshot());
  await page.click('#btnExport'); await page.waitForTimeout(400);
  const dl=page.waitForEvent('download',{timeout:15000});
  const it=await page.$('[data-x="dxf"]'); if(it) await it.click();
  const d=await dl; await d.saveAs(OUT('balloon.dxf'));
  console.log('javascript errors     :', errs.length, errs.slice(0,2));
  console.log(execSync(`python3 - <<'PY'
import ezdxf
d=ezdxf.readfile(${JSON.stringify(OUT('balloon.dxf'))}); msp=d.modelspace()
nums=[e for e in msp if e.dxftype()=='TEXT' and e.dxf.text in ('12','2')]
print('in the exported file: numbers', [e.dxf.text for e in nums])
for e in nums:
    r=[c for c in msp if c.dxftype()=='CIRCLE'
       and abs(c.dxf.center.x-e.dxf.align_point.x)<0.6
       and abs(c.dxf.center.y-e.dxf.align_point.y)<3]
    print('  ', repr(e.dxf.text), '-> circle around it:', len(r)>0,
          ('r=%.2f' % r[0].dxf.radius) if r else '')
PY`).toString().trim());
  await b.close();
})();

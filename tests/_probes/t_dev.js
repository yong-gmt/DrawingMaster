const {open,loadDxf}=require('./harness');
(async()=>{
  for(const dxf of ['Body_Demo_Drawing_Sheet1.dxf','Body_Demo_Drawing_Sheet3.dxf']){
    const {b,pg}=await open(require('./harness').APP);
    await loadDxf(pg,dxf);
    const r=await pg.evaluate(()=>{
      const h=window.__hook(); const P=h.store.pages.find(x=>x.id===h.store.activeId);
      const ms=P.dxf.dims||[];
      const devs=ms.map(m=>+m.dev.toFixed(3)).sort((a,b)=>b-a);
      const forms=ms.reduce((a,m)=>{const k=(m.line.arrowsOut?'out':'in')+(m.line.inside?'+mid':'')+((m.line.stub[0]||m.line.stub[1])?'+stub':'');a[k]=(a[k]||0)+1;return a;},{});
      return {n:ms.length, top5:devs.slice(0,5), forms,
        extVis:ms.filter(m=>!m.ext.visible[0]||!m.ext.visible[1]).length};
    });
    console.log(dxf, JSON.stringify(r));
    await b.close();
  }
})();

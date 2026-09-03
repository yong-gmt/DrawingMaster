#!/usr/bin/env python3
"""Add-on patch: the title block uses the supplied artwork, and the Stroke Weight
slider wears the app's own blue.

Kept as its own file rather than another block inside build.py: the logo arrives
as a very long base64 string, and threading that through nested Python quotes is
how the last three attempts turned into syntax errors instead of code.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build', 'DrawingMaster.html')

def rep(s, old, new, n=1):
    assert s.count(old) == n, (s.count(old), old[:70])
    return s.replace(old, new)

PROJ = '''/* The projection symbol, taken from Title_Block_projection.svg rather than drawn
   by hand: the artwork is the source, so what appears on the sheet is what was
   supplied. Its own drawing is 132 x 50 and it is fitted into the cell with a
   margin, so it never touches the ruled lines around it. */
const PROJ_SVG_W=132, PROJ_SVG_H=50, PROJ_PAD_MM=1.0;
const PROJ_ART={
  circles:[[101.265,24.664,16.78],[101.265,24.664,8.39]],
  lines:[[72.442,24.664,89.35,24.664],[114.017,24.664,130.568,24.664],
         [96.79,24.664,105.739,24.664],
         [101.265,1.042,101.265,12.241],[101.265,36.908,101.265,48.286],
         [101.265,19.682,101.265,28.631],
         [1.042,24.664,17.95,24.664],[42.616,24.664,59.167,24.664],
         [25.39,24.664,34.339,24.664]],
  cone:[[47.557,7.884],[47.557,41.443],[12.651,33.053],[12.651,16.273]]
};
function projSym(cx,cy,wmm,hmm){
  const boxW=Math.abs(mm2px(wmm));
  const boxH=Math.abs(mm2px(hmm!=null? hmm : wmm*PROJ_SVG_H/PROJ_SVG_W));
  const pad=mm2px(PROJ_PAD_MM);
  const s=Math.min((boxW-2*pad)/PROJ_SVG_W, (boxH-2*pad)/PROJ_SVG_H);
  /* a cell too small to hold it, or a back-to-front view, draws nothing rather
     than throwing and taking the whole render down */
  if(!isFinite(s) || s<=0.005) return;
  const c=W2S(cx,cy);
  const P=(x,y)=>[c.x+(x-PROJ_SVG_W/2)*s, c.y+(y-PROJ_SVG_H/2)*s];
  ctx.save();
  ctx.strokeStyle=INK;
  ctx.lineWidth=Math.max(0.7, s*2.08);
  ctx.lineCap='round'; ctx.lineJoin='round';
  PROJ_ART.circles.forEach(function(a){ const q=P(a[0],a[1]);
    ctx.beginPath(); ctx.arc(q[0],q[1],a[2]*s,0,7); ctx.stroke(); });
  PROJ_ART.lines.forEach(function(l){ const a=P(l[0],l[1]), b=P(l[2],l[3]);
    ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); });
  ctx.beginPath();
  PROJ_ART.cone.forEach(function(q,i){ const z=P(q[0],q[1]);
    i? ctx.lineTo(z[0],z[1]) : ctx.moveTo(z[0],z[1]); });
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}
function projSymDrawn(cx,cy,wmm){'''

LOGO_HEAD = '''/* The logo is the supplied image, filling its cell edge to edge with no margin.
   It loads once; until it arrives the cell is left empty rather than filled with
   a stand-in that would then have to be unlearned. */
const TB_LOGO_SRC='data:image/png;base64,'''

LOGO_TAIL = ''''
let _tbLogoImg=null, _tbLogoReady=false;
function tbLogoImage(){
  if(_tbLogoImg) return _tbLogoImg;
  _tbLogoImg=new Image();
  _tbLogoImg.onload=function(){ _tbLogoReady=true; try{ render(); }catch(e){} };
  _tbLogoImg.src=TB_LOGO_SRC;
  return _tbLogoImg;
}
function tbLogo(cx,cy,wmm,hmm){
  const img=tbLogoImage();
  if(!_tbLogoReady || !img.naturalWidth) return;
  const w=Math.abs(mm2px(wmm));
  const h=Math.abs(mm2px(hmm!=null? hmm : wmm*0.62));
  if(!(w>1 && h>1)) return;
  const c=W2S(cx,cy);
  const s=Math.min(w/img.naturalWidth, h/img.naturalHeight);
  const dw=img.naturalWidth*s, dh=img.naturalHeight*s;
  ctx.save();
  ctx.drawImage(img, c.x-dw/2, c.y-dh/2, dw, dh);
  ctx.restore();
}
function tbLogoDrawn(cx,cy,wmm){'''

def main():
    s = open(BUILD, encoding='utf-8').read()
    logo = open(os.path.join(ROOT, 'src', 'logo-b64.txt')).read().strip()

    s = rep(s, 'function projSym(cx,cy,wmm){', PROJ)
    s = rep(s, 'function tbLogo(cx,cy,wmm){', LOGO_HEAD + logo + LOGO_TAIL)

    # both are given the cell's real height, so they fit the box rather than a guess
    s = rep(s,
        "  projSym((X(FX.scl)+X(FX.tol))/2, (Y(FY.t2)+Y(FY.t3))/2, TB_W*(FX.tol-FX.scl));",
        "  projSym((X(FX.scl)+X(FX.tol))/2, (Y(FY.t2)+Y(FY.t3))/2,\n"
        "          TB_W*(FX.tol-FX.scl), TB_H*(FY.t3-FY.t2));")
    s = rep(s,
        "  tbLogo((X(FX.logo)+X(1))/2, (Y(FY.b1)+Y(1))/2, TB_W*(1-FX.logo));",
        "  tbLogo((X(FX.logo)+X(1))/2, (Y(FY.b1)+Y(1))/2,\n"
        "         TB_W*(1-FX.logo), TB_H*(1-FY.b1));")

    # the slider handle in the app's own blue, like every other control
    s = rep(s,
        "input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:19px;height:19px;border-radius:50%;\n  background:#111;cursor:pointer}",
        "input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:19px;height:19px;border-radius:50%;\n  background:var(--ink);cursor:pointer}")
    s = rep(s,
        "input[type=range]::-moz-range-thumb{width:19px;height:19px;border:none;border-radius:50%;background:#111;cursor:pointer}",
        "input[type=range]::-moz-range-thumb{width:19px;height:19px;border:none;border-radius:50%;background:var(--ink);cursor:pointer}")

    open(BUILD, 'w', encoding='utf-8').write(s)
    print('title-block artwork and slider colour applied')

if __name__ == '__main__':
    main()

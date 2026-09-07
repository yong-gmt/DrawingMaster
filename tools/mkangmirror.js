/* An angular dimension that has an identical twin.
 *
 * Both sides run straight THROUGH the vertex, so each gives two usable rays and
 * four pairings are possible. Two of them measure exactly 105 degrees: the one the
 * drawing shows, and its mirror image on the opposite side of the corner. Picking
 * on the number alone is a coin toss, and it landed on the mirror - the angle came
 * back drawn on the wrong side while reading a perfectly correct 105.
 *
 * The arc in the block is the tie-breaker: it is the arc the file drew.
 */
const fs=require('fs'), path=require('path');
const g=(c,v)=>c+'\n'+v+'\n';
const R=Math.PI/180;
const A0=0, A1=105, RAD=30, LEN=60;
const P=(a,d)=>[Math.cos(a*R)*d, Math.sin(a*R)*d];

const line=(l,p,q)=>g(0,'LINE')+g(8,l)+g(10,p[0])+g(20,p[1])+g(30,0)+g(11,q[0])+g(21,q[1])+g(31,0);
const arc=(l,cx,cy,r,s,e)=>g(0,'ARC')+g(8,l)+g(10,cx)+g(20,cy)+g(30,0)+g(40,r)+g(50,s)+g(51,e);
const text=(l,x,y,h,str)=>g(0,'TEXT')+g(8,l)+g(10,x)+g(20,y)+g(30,0)+g(40,h)+g(1,str)+g(72,1)+g(11,x)+g(21,y)+g(31,0);

/* the two sides, each running clean through the vertex */
const s1a=P(A0+180,LEN), s1b=P(A0,LEN);
const s2a=P(A1+180,LEN), s2b=P(A1,LEN);
const mid=P((A0+A1)/2, RAD);

const BLOCK='*DM1';
let blocks =g(0,'BLOCK')+g(8,'0')+g(2,BLOCK)+g(70,1)+g(10,0)+g(20,0)+g(30,0)+g(3,BLOCK)+g(1,'');
blocks+=arc('0',0,0,RAD,A0,A1);                       /* the arc the file drew */
blocks+=text('0', mid[0]*1.15, mid[1]*1.15, 2.5, '105°');
blocks+=g(0,'ENDBLK')+g(8,'0');

let ents ='';
ents+=line('0', s1a, s1b);
ents+=line('0', s2a, s2b);
ents+=g(0,'DIMENSION')+g(8,'0')+g(2,BLOCK)
    +g(10, s2b[0])+g(20, s2b[1])+g(30,0)               /* anchor  = line 2, point B */
    +g(11, mid[0])+g(21, mid[1])+g(31,0)               /* text midpoint */
    +g(70,34)+g(71,5)+g(1,'')
    +g(13, s1a[0])+g(23, s1a[1])+g(33,0)               /* line 1 */
    +g(14, s1b[0])+g(24, s1b[1])+g(34,0)
    +g(15, s2a[0])+g(25, s2a[1])+g(35,0)               /* line 2, point A */
    +g(16, mid[0])+g(26, mid[1])+g(36,0);              /* a point on the arc */

const out=path.join(__dirname,'..','fixtures','synthetic','ang_mirror.dxf');
fs.writeFileSync(out,
  g(0,'SECTION')+g(2,'HEADER')+g(9,'$INSUNITS')+g(70,4)+g(0,'ENDSEC')
 +g(0,'SECTION')+g(2,'BLOCKS')+blocks+g(0,'ENDSEC')
 +g(0,'SECTION')+g(2,'ENTITIES')+ents+g(0,'ENDSEC')+g(0,'EOF'));
console.log('wrote '+out+'   (the drawing shows '+A0+'° to '+A1+'°)');

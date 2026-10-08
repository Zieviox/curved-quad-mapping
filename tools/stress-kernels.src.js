// ================= kernels: every method under test, written once =================
// The page uses three builds of this code, made automatically from this one source:
//  · float64: as written (timed);
//  · float32: every + − × ÷ and every square root, cube root, cos, acos rounded to float32 (Math.fround) — a × b + c rounds once (fused);
//  · counted: every operation tallied (ADD, MUL, FMA = a × b ± c, DIV, SQRT, MIN, MAX, CMP, NEG, LIB = cbrt / acos / cos) — for the cycle model.
// Rules for this source: no compound assignment (+=); integers only for loop and array indices.

// ---------- solving ----------

// K of one edge, arc only: K = B1 − sg·√max(0, c·B0·B2); a straight edge (or an arc seen edge-on): K = B1
function kArc(e,x,y){var b1=e.b1x*x+e.b1y*y+e.b10;if(e.t===0)return b1;var q=e.c*(e.b0x*x+e.b0y*y+e.b00)*(e.b2x*x+e.b2y*y+e.b20);return b1-e.sg*Math.sqrt(Math.max(0,q))}
// K of one edge, full conic: K = s·B1² − s·4w'²·B0·B2 (also 0 on the rest of the ellipse)
function kConic(e,x,y){var b1=e.b1x*x+e.b1y*y+e.b10;if(e.t===0)return b1;return e.s*b1*b1-e.cw*(e.b0x*x+e.b0y*y+e.b00)*(e.b2x*x+e.b2y*y+e.b20)}
// u, v from the edges (steps 13–15): u = K3/(K3+K1), v = K0/(K0+K2). Returns true when all 4 K ≥ 0 (inside the edges).
function uvEdgesArc(c,x,y,out){var K0=kArc(c.ka0,x,y),K1=kArc(c.ka1,x,y),K2=kArc(c.ka2,x,y),K3=kArc(c.ka3,x,y);out[0]=K3/(K3+K1);out[1]=K0/(K0+K2);return K0>=0&&K1>=0&&K2>=0&&K3>=0}
function uvEdgesConic(c,x,y,out){var K0=kConic(c.kc0,x,y),K1=kConic(c.kc1,x,y),K2=kConic(c.kc2,x,y),K3=kConic(c.kc3,x,y);out[0]=K3/(K3+K1);out[1]=K0/(K0+K2);return K0>=0&&K1>=0&&K2>=0&&K3>=0}

// one point of a rational quadratic arc {P0, A, P2, w} (straight: A = midpoint, w = 1) → ar[0..2]
function arcAt(g,t,ar){var r=1-t,b0=r*r,b1=2*g.w*r*t,b2=t*t,s=1/(b0+b1+b2);ar[0]=(g.p0x*b0+g.ax*b1+g.p2x*b2)*s;ar[1]=(g.p0y*b0+g.ay*b1+g.p2y*b2)*s;ar[2]=(g.p0z*b0+g.az*b1+g.p2z*b2)*s}
// P(u, v), the step 10 forward map: the planes of the u = 0 / u = 1 edges blended by u, of v = 0 / v = 1 by v; the two planes meet in a line; the line hits the
// piece's quadric (one quadratic); of the two roots, the one nearest the blend of the 4 edge arcs. → out[0..2] (world). Returns false if there is no point.
function pointAt(m,u,v,out,ar){var iu=1-u,iv=1-v;
  var ux=m.n3x*iu+m.n1x*u,uy=m.n3y*iu+m.n1y*u,uz=m.n3z*iu+m.n1z*u,uh=m.h3*iu+m.h1*u;
  var vx=m.n0x*iv+m.n2x*v,vy=m.n0y*iv+m.n2y*v,vz=m.n0z*iv+m.n2z*v,vh=m.h0*iv+m.h2*v;
  var dx=uy*vz-uz*vy,dy=uz*vx-ux*vz,dz=ux*vy-uy*vx,DD=dx*dx+dy*dy+dz*dz;if(!(DD>1e-20))return false;
  var x0=((vy*dz-vz*dy)*uh+(dy*uz-dz*uy)*vh)/DD,y0=((vz*dx-vx*dz)*uh+(dz*ux-dx*uz)*vh)/DD,z0=((vx*dy-vy*dx)*uh+(dx*uy-dy*ux)*vh)/DD;
  var il=1/Math.sqrt(DD),ex=dx*il,ey=dy*il,ez=dz*il;
  var Aex=m.A00*ex+m.A01*ey+m.A02*ez,Aey=m.A01*ex+m.A11*ey+m.A12*ez,Aez=m.A02*ex+m.A12*ey+m.A22*ez;
  var Axx=m.A00*x0+m.A01*y0+m.A02*z0,Axy=m.A01*x0+m.A11*y0+m.A12*z0,Axz=m.A02*x0+m.A12*y0+m.A22*z0;
  var a=ex*Aex+ey*Aey+ez*Aez,b=(2*Axx+m.gx)*ex+(2*Axy+m.gy)*ey+(2*Axz+m.gz)*ez,cq=x0*Axx+y0*Axy+z0*Axz+m.gx*x0+m.gy*y0+m.gz*z0+m.k;
  var w00=iu*iv,w10=u*iv,w11=u*v,w01=iu*v;
  arcAt(m.e0,u,ar);var bx=ar[0]*iv,by=ar[1]*iv,bz=ar[2]*iv;
  arcAt(m.e2,iu,ar);bx=bx+ar[0]*v;by=by+ar[1]*v;bz=bz+ar[2]*v;
  arcAt(m.e3,iv,ar);bx=bx+ar[0]*iu;by=by+ar[1]*iu;bz=bz+ar[2]*iu;
  arcAt(m.e1,v,ar);bx=bx+ar[0]*u;by=by+ar[1]*u;bz=bz+ar[2]*u;
  bx=bx-(m.P0x*w00+m.P1x*w10+m.P2x*w11+m.P3x*w01);by=by-(m.P0y*w00+m.P1y*w10+m.P2y*w11+m.P3y*w01);bz=bz-(m.P0z*w00+m.P1z*w10+m.P2z*w11+m.P3z*w01);
  var tr=((bx-m.c0x)*m.sc-x0)*ex+((by-m.c0y)*m.sc-y0)*ey+((bz-m.c0z)*m.sc-z0)*ez,t=0;
  if(Math.abs(a)<1e-12){if(!(Math.abs(b)>1e-15))return false;t=-cq/b}
  else{var D=b*b-4*a*cq;if(D<0&&D>-1e-9*(b*b+Math.abs(4*a*cq)+1e-30))D=0;if(!(D>=0))return false;var s=Math.sqrt(D),r1=(-b+s)/(2*a),r2=(-b-s)/(2*a);t=Math.abs(r1-tr)<Math.abs(r2-tr)?r1:r2}
  var is=1/m.sc;out[0]=m.c0x+(x0+ex*t)*is;out[1]=m.c0y+(y0+ey*t)*is;out[2]=m.c0z+(z0+ez*t)*is;return true}

// the pixel's ray in the piece's local frame: direction d = D0 + x·Dx + y·Dy; quadric along it: a = d·A·d, b = (2·A·o + g)·d, c = Q(o) (fixed per frame)
// side planes along it: s_k = so_k + t·(n_k·d). u = s3/(s3−s1), v = s0/(s0−s2); inside when s3 ≥ 0, s1 ≤ 0, s0 ≥ 0, s2 ≤ 0.
function planesAt(c,t,dx,dy,dz,out){var s0=c.so0+t*(c.n0x*dx+c.n0y*dy+c.n0z*dz),s1=c.so1+t*(c.n1x*dx+c.n1y*dy+c.n1z*dz),s2=c.so2+t*(c.n2x*dx+c.n2y*dy+c.n2z*dz),s3=c.so3+t*(c.n3x*dx+c.n3y*dy+c.n3z*dz);
  if(s3<-1e-9||s1>1e-9||s0<-1e-9||s2>1e-9)return false;out[0]=s3/(s3-s1);out[1]=s0/(s0-s2);out[2]=t;return true}
// step 11 without its check: of the ray's hits (nearest first), the first inside the side planes
function rayPlanes(c,x,y,out){var dx=c.D0x+x*c.Dxx+y*c.Dyx,dy=c.D0y+x*c.Dxy+y*c.Dyy,dz=c.D0z+x*c.Dxz+y*c.Dyz;
  var Adx=c.A00*dx+c.A01*dy+c.A02*dz,Ady=c.A01*dx+c.A11*dy+c.A12*dz,Adz=c.A02*dx+c.A12*dy+c.A22*dz,a=dx*Adx+dy*Ady+dz*Adz,b=c.box*dx+c.boy*dy+c.boz*dz,t1=0,t2=0;
  if(Math.abs(a)<1e-14){if(Math.abs(b)<1e-14)return false;t1=-c.cq/b;t2=t1}
  else{var D=b*b-4*a*c.cq;if(D<0)return false;var s=Math.sqrt(D),q=-0.5*(b+(b<0?-s:s));t1=q/a;t2=c.cq/q;if(t2<t1){var tt=t1;t1=t2;t2=tt}}
  if(t1>1e-9&&planesAt(c,t1,dx,dy,dz,out))return true;return t2>1e-9&&planesAt(c,t2,dx,dy,dz,out)}
// step 11 as built: the same, and the hit must also be where P(u, v) lands (otherwise it is on the quadric's other sheet)
function rayCheck(c,x,y,out,ar,p){var dx=c.D0x+x*c.Dxx+y*c.Dyx,dy=c.D0y+x*c.Dxy+y*c.Dyy,dz=c.D0z+x*c.Dxz+y*c.Dyz;
  var Adx=c.A00*dx+c.A01*dy+c.A02*dz,Ady=c.A01*dx+c.A11*dy+c.A12*dz,Adz=c.A02*dx+c.A12*dy+c.A22*dz,a=dx*Adx+dy*Ady+dz*Adz,b=c.box*dx+c.boy*dy+c.boz*dz,t1=0,t2=0;
  if(Math.abs(a)<1e-14){if(Math.abs(b)<1e-14)return false;t1=-c.cq/b;t2=t1}
  else{var D=b*b-4*a*c.cq;if(D<0)return false;var s=Math.sqrt(D),q=-0.5*(b+(b<0?-s:s));t1=q/a;t2=c.cq/q;if(t2<t1){var tt=t1;t1=t2;t2=tt}}
  if(t1>1e-9&&planesAt(c,t1,dx,dy,dz,out)&&onSheet(c,t1,dx,dy,dz,out,ar,p))return true;
  return t2>1e-9&&planesAt(c,t2,dx,dy,dz,out)&&onSheet(c,t2,dx,dy,dz,out,ar,p)}
function onSheet(c,t,dx,dy,dz,out,ar,p){if(!pointAt(c.m,Math.min(1,Math.max(0,out[0])),Math.min(1,Math.max(0,out[1])),p,ar))return false;
  var is=1/c.sc,X=c.c0x+(c.ox+t*dx)*is,Y=c.c0y+(c.oy+t*dy)*is,Z=c.c0z+(c.oz+t*dz)*is,ex=p[0]-X,ey=p[1]-Y,ez=p[2]-Z;
  return Math.sqrt(ex*ex+ey*ey+ez*ez)<=1e-6*(1+Math.sqrt(X*X+Y*Y+Z*Z))}
// the sign rule: one root, t = (−b − s·√D)/2a with s = σ·f (σ: the quadric's gradient points outward (+1) or inward (−1); f: the piece faces the camera (+1) or away (−1))
function raySign(c,x,y,out){var dx=c.D0x+x*c.Dxx+y*c.Dyx,dy=c.D0y+x*c.Dxy+y*c.Dyy,dz=c.D0z+x*c.Dxz+y*c.Dyz;
  var Adx=c.A00*dx+c.A01*dy+c.A02*dz,Ady=c.A01*dx+c.A11*dy+c.A12*dz,Adz=c.A02*dx+c.A12*dy+c.A22*dz,a=dx*Adx+dy*Ady+dz*Adz,b=c.box*dx+c.boy*dy+c.boz*dz,t=0;
  if(Math.abs(a)<1e-14){if(Math.abs(b)<1e-14)return false;t=-c.cq/b}
  else{var D=b*b-4*a*c.cq;if(D<0&&D>-1e-9*(b*b+Math.abs(4*a*c.cq)+1e-30))D=0;if(!(D>=0))return false;t=(-b-c.sgn*Math.sqrt(D))/(2*a)}
  return t>1e-9&&planesAt(c,t,dx,dy,dz,out)}

// per-pixel facing: of the two hits, the one where the surface faces the camera (outward normal against the ray): t = (−b − σ·√D)/2a, σ alone, no per-piece flag
function rayFacing(c,x,y,out){var dx=c.D0x+x*c.Dxx+y*c.Dyx,dy=c.D0y+x*c.Dxy+y*c.Dyy,dz=c.D0z+x*c.Dxz+y*c.Dyz;
  var Adx=c.A00*dx+c.A01*dy+c.A02*dz,Ady=c.A01*dx+c.A11*dy+c.A12*dz,Adz=c.A02*dx+c.A12*dy+c.A22*dz,a=dx*Adx+dy*Ady+dz*Adz,b=c.box*dx+c.boy*dy+c.boz*dz,t=0;
  if(Math.abs(a)<1e-14){if(Math.abs(b)<1e-14)return false;t=-c.cq/b}
  else{var D=b*b-4*a*c.cq;if(D<0&&D>-1e-9*(b*b+Math.abs(4*a*c.cq)+1e-30))D=0;if(!(D>=0))return false;t=(-b-c.sig*Math.sqrt(D))/(2*a)}
  return t>1e-9&&planesAt(c,t,dx,dy,dz,out)}

// ---- same level (your idea): the u where the pixel lies on the line from the bottom edge's B(u) to the top edge's T(u); v = how far along that line (in 3D).
// On the screen: det[pixel, B̂(u), T̂(u)] = 0, a quartic in u (B̂, T̂ are quadratic). Its 5 coefficients are affine in the pixel: q_i = x·qx_i + y·qy_i + q0_i.
function sameLevel(c,x,y,out,r,ar,br){var n=solveQuartic(c.q4x*x+c.q4y*y+c.q40,c.q3x*x+c.q3y*y+c.q30,c.q2x*x+c.q2y*y+c.q20,c.q1x*x+c.q1y*y+c.q10,c.q0x*x+c.q0y*y+c.q00,r),found=false,bz=0;
  for(var i=0;i<n;i++){var u=r[i];if(!(u>=-1e-9&&u<=1+1e-9))continue;arcAt(c.eb,u,ar);arcAt(c.et,u,br);   // B(u), T(u) in camera coordinates (right, down, forward)
    var drr=br[0]-ar[0],ddd=br[1]-ar[1],dzz=br[2]-ar[2],xc=x-c.h,yc=y-c.h,nx=c.f*ar[0]-xc*ar[2],mx=xc*dzz-c.f*drr,ny=c.f*ar[1]-yc*ar[2],my=yc*dzz-c.f*ddd;
    var lam=Math.abs(mx)>Math.abs(my)?nx/mx:ny/my;if(!(lam>=-1e-9&&lam<=1+1e-9))continue;var z=ar[2]+lam*dzz;
    if(!found||z<bz){found=true;bz=z;out[0]=u;out[1]=lam;out[2]=z}}
  return found}
// closed-form polynomial roots (written into r, count returned): quadratic, cubic (Cardano / trigonometric), quartic (Ferrari)
function solveQuadratic(a,b,c,r,k){if(Math.abs(a)<=1e-14*(Math.abs(b)+Math.abs(c))){if(b!==0){r[k++]=-c/b}return k}
  var D=b*b-4*a*c;if(D<0)return k;var s=Math.sqrt(D),q=-0.5*(b+(b<0?-s:s));if(q!==0){r[k++]=q/a;r[k++]=c/q;return k}r[k++]=0;return k}
function solveCubic(a,b,c,d,r,k){if(Math.abs(a)<=1e-14*(Math.abs(b)+Math.abs(c)+Math.abs(d)))return solveQuadratic(b,c,d,r,k);
  var B=b/a,C=c/a,D=d/a,B3=B/3,P=C-B*B3,Q=(2*B3*B3-C)*B3+D,disc=0.25*Q*Q+P*P*P/27;
  if(disc>0){var sd=Math.sqrt(disc);r[k++]=Math.cbrt(-0.5*Q+sd)+Math.cbrt(-0.5*Q-sd)-B3;return k}
  if(P===0){r[k++]=-B3;return k}
  var m=2*Math.sqrt(-P/3),arg=Math.max(-1,Math.min(1,(3*Q/(2*P))*Math.sqrt(-3/P))),phi=Math.acos(arg)/3;
  r[k++]=m*Math.cos(phi)-B3;r[k++]=m*Math.cos(phi-2.0943951023931957)-B3;r[k++]=m*Math.cos(phi-4.1887902047863905)-B3;return k}
function solveQuartic(a,b,c,d,e,r){if(Math.abs(a)<=1e-12*(Math.abs(b)+Math.abs(c)+Math.abs(d)+Math.abs(e)))return solveCubic(b,c,d,e,r,0);
  var B=b/a,C=c/a,D=d/a,E=e/a,B4=B/4,BB=B*B,p=C-0.375*BB,q=D-0.5*B*C+0.125*BB*B,s4=E-0.25*B*D+0.0625*BB*C-0.01171875*BB*BB,k=0,j=0,i=0;
  if(Math.abs(q)<=1e-14*(1+Math.abs(p)+Math.abs(s4))){j=solveQuadratic(1,p,s4,r,4);   // biquadratic: y² = z
    for(i=4;i<j;i++){var z=r[i];if(z>=0){var sz=Math.sqrt(z);r[k++]=sz-B4;r[k++]=-sz-B4}}return k}
  j=solveCubic(1,p,0.25*p*p-s4,-0.125*q*q,r,4);var mm=r[4];for(i=5;i<j;i++){if(r[i]>mm)mm=r[i]}if(!(mm>0))return 0;   // resolvent: the largest root
  var sq=Math.sqrt(2*mm),h=0.5*p+mm,g=q/(2*sq);
  j=solveQuadratic(1,sq,h-g,r,4);j=solveQuadratic(1,-sq,h+g,r,j);for(i=4;i<j;i++){r[k++]=r[i]-B4}return k}

// ---------- detection ----------

// screen box from the edges' projected control points (closed form; bounds the edges, not a fold's bulge)
function inBox(c,x,y){return x>=c.bx0&&x<=c.bx1&&y>=c.by0&&y<=c.by1}
// the bulge box: the control-point box widened by the piece's outline points (see bulgeBox on the page)
function inWalkBox(c,x,y){return x>=c.wx0&&x<=c.wx1&&y>=c.wy0&&y<=c.wy1}
// inside the 4 edges: all K ≥ 0
function insideEdges(c,x,y){return kArc(c.ka0,x,y)>=0&&kArc(c.ka1,x,y)>=0&&kArc(c.ka2,x,y)>=0&&kArc(c.ka3,x,y)>=0}
// one pixel row against one edge: f·down(t) − (Y − W/2)·forward(t) = 0 (quadratic; linear for a straight edge); crossings with t in [0, 1) inserted sorted into xs[0..n)
function crossEdge(e,Y,xs,n){var yc=Y-e.h,h0=e.f*e.d0-yc*e.z0,A=0,B=0,t1=0,t2=0,m=0;
  if(e.straight===1){B=(e.f*e.d2-yc*e.z2)-h0}else{var hb=e.w*(e.f*e.d1-yc*e.z1),hd=e.f*e.d2-yc*e.z2;A=h0-2*hb+hd;B=2*(hb-h0)}
  if(Math.abs(A)<=1e-12*(Math.abs(B)+Math.abs(h0))){if(B===0)return n;t1=-h0/B;m=1}
  else{var D=B*B-4*A*h0;if(D<0)return n;var s=Math.sqrt(D),q=-0.5*(B+(B<0?-s:s));if(q!==0){t1=q/A;t2=h0/q}m=2}
  for(var i=0;i<m;i++){var t=i===0?t1:t2;if(!(t>=0&&t<1))continue;var r=0,z=0;
    if(e.straight===1){r=e.r0+(e.r2-e.r0)*t;z=e.z0+(e.z2-e.z0)*t}else{var o=1-t,b0=o*o,b1=2*e.w*t*o,b2=t*t;r=b0*e.r0+b1*e.r1+b2*e.r2;z=b0*e.z0+b1*e.z1+b2*e.z2}
    if(z>0){var X=e.h+e.f*r/z,j=n;n++;while(j>0&&xs[j-1]>X){xs[j]=xs[j-1];j--}xs[j]=X}}
  return n}
function crossRow(c,Y,xs){var n=crossEdge(c.ce0,Y,xs,0);n=crossEdge(c.ce1,Y,xs,n);n=crossEdge(c.ce2,Y,xs,n);return crossEdge(c.ce3,Y,xs,n)}

// ---------- packed: every piece's numbers in one flat Float64Array, PSTRIDE numbers per piece, ordered by how often they are used ----------
// per pixel (ray) → per span (edge K) → per row (crossings) → per frame (box) → P(u, v). Inside a span nothing is read from it:
// the values that change along the row are set up once at the span's first pixel and stepped in local variables.
var PSTRIDE=240,O_D0=0,O_DX=3,O_DY=6,O_A=9,O_BO=15,O_CQ=18,O_SGN=19,O_PL=20,O_O=36,O_C0=39,O_SC=42,O_SIG=43,O_NW=44,O_NG=47,O_K=48,O_R=96,O_BOX=144,O_WBOX=148,O_M=152;
// O_A: A00 A01 A02 A11 A12 A22 · O_PL: per plane n_x n_y n_z so (4 × 4) · O_K: per edge t b1x b1y b10 b0x b0y b00 b2x b2y b20 c sg (4 × 12)
// O_R: per edge straight w r0 d0 z0 r1 d1 z1 r2 d2 z2 – (4 × 12) · O_BOX: bx0 bx1 by0 by1 (edges' control points) · O_WBOX: wx0 wx1 wy0 wy1 (bulge box) · O_M (P(u, v)): n (4 × 3) h (4) A (6) g (3) k sc c0 (3) corners (4 × 3) arcs (4 × 10: p0 a p2 w)
function packLayout(){return{PSTRIDE:PSTRIDE,O_D0:O_D0,O_DX:O_DX,O_DY:O_DY,O_A:O_A,O_BO:O_BO,O_CQ:O_CQ,O_SGN:O_SGN,O_PL:O_PL,O_O:O_O,O_C0:O_C0,O_SC:O_SC,O_SIG:O_SIG,O_NW:O_NW,O_NG:O_NG,O_K:O_K,O_R:O_R,O_BOX:O_BOX,O_WBOX:O_WBOX,O_M:O_M}}
function arcAtP(B,o,t,ar){var r=1-t,b0=r*r,b1=2*B[o+9]*r*t,b2=t*t,s=1/(b0+b1+b2);ar[0]=(B[o]*b0+B[o+3]*b1+B[o+6]*b2)*s;ar[1]=(B[o+1]*b0+B[o+4]*b1+B[o+7]*b2)*s;ar[2]=(B[o+2]*b0+B[o+5]*b1+B[o+8]*b2)*s}
// P(u, v) from the packed block (same formulas as pointAt)
function pointAtP(B,m,u,v,out,ar){var iu=1-u,iv=1-v;
  var ux=B[m+9]*iu+B[m+3]*u,uy=B[m+10]*iu+B[m+4]*u,uz=B[m+11]*iu+B[m+5]*u,uh=B[m+15]*iu+B[m+13]*u;
  var vx=B[m]*iv+B[m+6]*v,vy=B[m+1]*iv+B[m+7]*v,vz=B[m+2]*iv+B[m+8]*v,vh=B[m+12]*iv+B[m+14]*v;
  var dx=uy*vz-uz*vy,dy=uz*vx-ux*vz,dz=ux*vy-uy*vx,DD=dx*dx+dy*dy+dz*dz;if(!(DD>1e-20))return false;
  var x0=((vy*dz-vz*dy)*uh+(dy*uz-dz*uy)*vh)/DD,y0=((vz*dx-vx*dz)*uh+(dz*ux-dx*uz)*vh)/DD,z0=((vx*dy-vy*dx)*uh+(dx*uy-dy*ux)*vh)/DD;
  var il=1/Math.sqrt(DD),ex=dx*il,ey=dy*il,ez=dz*il,A00=B[m+16],A01=B[m+17],A02=B[m+18],A11=B[m+19],A12=B[m+20],A22=B[m+21],gx=B[m+22],gy=B[m+23],gz=B[m+24];
  var Aex=A00*ex+A01*ey+A02*ez,Aey=A01*ex+A11*ey+A12*ez,Aez=A02*ex+A12*ey+A22*ez,Axx=A00*x0+A01*y0+A02*z0,Axy=A01*x0+A11*y0+A12*z0,Axz=A02*x0+A12*y0+A22*z0;
  var a=ex*Aex+ey*Aey+ez*Aez,b=(2*Axx+gx)*ex+(2*Axy+gy)*ey+(2*Axz+gz)*ez,cq=x0*Axx+y0*Axy+z0*Axz+gx*x0+gy*y0+gz*z0+B[m+25];
  var w00=iu*iv,w10=u*iv,w11=u*v,w01=iu*v;
  arcAtP(B,m+42,u,ar);var bx=ar[0]*iv,by=ar[1]*iv,bz=ar[2]*iv;
  arcAtP(B,m+62,iu,ar);bx=bx+ar[0]*v;by=by+ar[1]*v;bz=bz+ar[2]*v;
  arcAtP(B,m+72,iv,ar);bx=bx+ar[0]*iu;by=by+ar[1]*iu;bz=bz+ar[2]*iu;
  arcAtP(B,m+52,v,ar);bx=bx+ar[0]*u;by=by+ar[1]*u;bz=bz+ar[2]*u;
  bx=bx-(B[m+30]*w00+B[m+33]*w10+B[m+36]*w11+B[m+39]*w01);by=by-(B[m+31]*w00+B[m+34]*w10+B[m+37]*w11+B[m+40]*w01);bz=bz-(B[m+32]*w00+B[m+35]*w10+B[m+38]*w11+B[m+41]*w01);
  var sc=B[m+26],tr=((bx-B[m+27])*sc-x0)*ex+((by-B[m+28])*sc-y0)*ey+((bz-B[m+29])*sc-z0)*ez,t=0;
  if(Math.abs(a)<1e-12){if(!(Math.abs(b)>1e-15))return false;t=-cq/b}
  else{var D=b*b-4*a*cq;if(D<0&&D>-1e-9*(b*b+Math.abs(4*a*cq)+1e-30))D=0;if(!(D>=0))return false;var s=Math.sqrt(D),r1=(-b+s)/(2*a),r2=(-b-s)/(2*a);t=Math.abs(r1-tr)<Math.abs(r2-tr)?r1:r2}
  var is=1/sc;out[0]=B[m+27]+(x0+ex*t)*is;out[1]=B[m+28]+(y0+ey*t)*is;out[2]=B[m+29]+(z0+ez*t)*is;return true}
// one pixel row against the piece's 4 edges (same formulas as crossRow); crossings sorted into xs
function crossRowP(B,b,Y,xs,f,h){var n=0;for(var k=0;k<4;k++){var o=b+O_R+12*k,yc=Y-h,h0=f*B[o+3]-yc*B[o+4],A=0,Bq=0,t1=0,t2=0,m=0;
    if(B[o]===1){Bq=(f*B[o+9]-yc*B[o+10])-h0}else{var hb=B[o+1]*(f*B[o+6]-yc*B[o+7]),hd=f*B[o+9]-yc*B[o+10];A=h0-2*hb+hd;Bq=2*(hb-h0)}
    if(Math.abs(A)<=1e-12*(Math.abs(Bq)+Math.abs(h0))){if(Bq===0)continue;t1=-h0/Bq;m=1}
    else{var D=Bq*Bq-4*A*h0;if(D<0)continue;var s=Math.sqrt(D),q=-0.5*(Bq+(Bq<0?-s:s));if(q!==0){t1=q/A;t2=h0/q}m=2}
    for(var i=0;i<m;i++){var t=i===0?t1:t2;if(!(t>=0&&t<1))continue;var r=0,z=0;
      if(B[o]===1){r=B[o+2]+(B[o+8]-B[o+2])*t;z=B[o+4]+(B[o+10]-B[o+4])*t}else{var w=1-t,b0=w*w,b1=2*B[o+1]*t*w,b2=t*t;r=b0*B[o+2]+b1*B[o+5]+b2*B[o+8];z=b0*B[o+4]+b1*B[o+7]+b2*B[o+10]}
      if(z>0){var X=h+f*r/z,j=n;n++;while(j>0&&xs[j-1]>X){xs[j]=xs[j-1];j--}xs[j]=X}}}
  return n}
// a span, pipeline A (now): u, v from the edges (K stepped along the row), then P(u, v), then depth; nearest kept, packed output (u, v as 16-bit fixed point)
function spanEdgeP(B,b,Y,x0,x1,W,cp,z,pid,uq,vq,id,S,out,ar){var X=x0+0.5,w=0;
  for(var k=0;k<4;k++){var o=b+O_K+12*k,s=7*k;S[s]=B[o+1]*X+B[o+2]*Y+B[o+3];S[s+1]=B[o+1];S[s+5]=B[o];S[s+6]=B[o+11];
    if(B[o]!==0){var e0=B[o+4]*X+B[o+5]*Y+B[o+6],e2=B[o+7]*X+B[o+8]*Y+B[o+9],q0=B[o+10]*e0*e2,q1=B[o+10]*(e0+B[o+4])*(e2+B[o+7]),q2=B[o+10]*(e0+2*B[o+4])*(e2+2*B[o+7]);S[s+2]=q0;S[s+3]=q1-q0;S[s+4]=q2-2*q1+q0}}
  for(var x=x0;x<=x1;x++){
    var K0=S[5]===0?S[0]:S[0]-S[6]*Math.sqrt(Math.max(0,S[2])),K1=S[12]===0?S[7]:S[7]-S[13]*Math.sqrt(Math.max(0,S[9])),K2=S[19]===0?S[14]:S[14]-S[20]*Math.sqrt(Math.max(0,S[16])),K3=S[26]===0?S[21]:S[21]-S[27]*Math.sqrt(Math.max(0,S[23]));
    S[0]=S[0]+S[1];S[2]=S[2]+S[3];S[3]=S[3]+S[4];S[7]=S[7]+S[8];S[9]=S[9]+S[10];S[10]=S[10]+S[11];S[14]=S[14]+S[15];S[16]=S[16]+S[17];S[17]=S[17]+S[18];S[21]=S[21]+S[22];S[23]=S[23]+S[24];S[24]=S[24]+S[25];
    var u=Math.min(1,Math.max(0,K3/(K3+K1))),v=Math.min(1,Math.max(0,K0/(K0+K2)));
    if(!pointAtP(B,b+O_M,u,v,out,ar))continue;var d=(out[0]-cp[0])*cp[3]+(out[1]-cp[1])*cp[4]+(out[2]-cp[2])*cp[5],o2=(Y-0.5)*W+x;
    if(z[o2]===0||d<z[o2]){z[o2]=d;pid[o2]=id;uq[o2]=Math.round(u*65535);vq[o2]=Math.round(v*65535);w++}}
  return w}
// a span, pipelines B / B′: the pixel's ray against the piece's quadric, everything stepped along the row:
// d (3 adds), a = d·A·d (quadratic: 2 adds), b = bo·d (1 add), the 4 planes' n·d (4 adds). mode 0: nearest hit inside the planes · 1: sign rule · 2: nearest + forward-map check · 3: per-pixel facing · 4: per-pixel facing + the normal at the hit points the piece's way
// (the cube fix: on a shared sphere a back piece's facing hit is the antipode of its own surface; its normal points the other way. σ·∇Q(X)·out = NG + t·(NW·d), stepped)
function spanRay(B,b,Y,x0,x1,W,mode,z,pid,uq,vq,id,out,ar,p){var X=x0+0.5,w=0,A00=B[b+O_A],A01=B[b+O_A+1],A02=B[b+O_A+2],A11=B[b+O_A+3],A12=B[b+O_A+4],A22=B[b+O_A+5],cq=B[b+O_CQ];
  var sx=B[b+O_DX],sy=B[b+O_DX+1],sz=B[b+O_DX+2],dx=B[b+O_D0]+X*sx+Y*B[b+O_DY],dy=B[b+O_D0+1]+X*sy+Y*B[b+O_DY+1],dz=B[b+O_D0+2]+X*sz+Y*B[b+O_DY+2];
  var Asx=A00*sx+A01*sy+A02*sz,Asy=A01*sx+A11*sy+A12*sz,Asz=A02*sx+A12*sy+A22*sz,Adx=A00*dx+A01*dy+A02*dz,Ady=A01*dx+A11*dy+A12*dz,Adz=A02*dx+A12*dy+A22*dz;
  var a=dx*Adx+dy*Ady+dz*Adz,dd=2*(sx*Adx+sy*Ady+sz*Adz),sAs=sx*Asx+sy*Asy+sz*Asz,da=dd+sAs,dda=2*sAs,bb=B[b+O_BO]*dx+B[b+O_BO+1]*dy+B[b+O_BO+2]*dz,db=B[b+O_BO]*sx+B[b+O_BO+1]*sy+B[b+O_BO+2]*sz;
  var P=b+O_PL,n0=B[P]*dx+B[P+1]*dy+B[P+2]*dz,s0=B[P]*sx+B[P+1]*sy+B[P+2]*sz,n1=B[P+4]*dx+B[P+5]*dy+B[P+6]*dz,s1=B[P+4]*sx+B[P+5]*sy+B[P+6]*sz,n2=B[P+8]*dx+B[P+9]*dy+B[P+10]*dz,s2=B[P+8]*sx+B[P+9]*sy+B[P+10]*sz,n3=B[P+12]*dx+B[P+13]*dy+B[P+14]*dz,s3=B[P+12]*sx+B[P+13]*sy+B[P+14]*sz;
  var o0=B[P+3],o1=B[P+7],o2=B[P+11],o3=B[P+15],sgn=mode>=3?B[b+O_SIG]:B[b+O_SGN],ng=B[b+O_NG],nwd=B[b+O_NW]*dx+B[b+O_NW+1]*dy+B[b+O_NW+2]*dz,nws=B[b+O_NW]*sx+B[b+O_NW+1]*sy+B[b+O_NW+2]*sz;
  for(var x=x0;x<=x1;x++){var t=-1,u=0,v=0,ok=false;
    if(mode===1||mode>=3){var D=bb*bb-4*a*cq;if(D<0&&D>-1e-9*(bb*bb+Math.abs(4*a*cq)+1e-30))D=0;if(D>=0){t=Math.abs(a)<1e-14?-cq/bb:(-bb-sgn*Math.sqrt(D))/(2*a);
        if(t>1e-9&&(mode!==4||ng+t*nwd>0)){var q0=o0+t*n0,q1=o1+t*n1,q2=o2+t*n2,q3=o3+t*n3;if(!(q3<-1e-9||q1>1e-9||q0<-1e-9||q2>1e-9)){u=q3/(q3-q1);v=q0/(q0-q2);ok=true}}}}
    else{var t1=0,t2=0,has=true;if(Math.abs(a)<1e-14){if(Math.abs(bb)<1e-14)has=false;else{t1=-cq/bb;t2=t1}}else{var D2=bb*bb-4*a*cq;if(D2<0)has=false;else{var s=Math.sqrt(D2),q=-0.5*(bb+(bb<0?-s:s));t1=q/a;t2=cq/q;if(t2<t1){var tt=t1;t1=t2;t2=tt}}}
      for(var r=0;r<2&&has&&!ok;r++){t=r===0?t1:t2;if(!(t>1e-9))continue;var p0=o0+t*n0,p1=o1+t*n1,p2=o2+t*n2,p3=o3+t*n3;if(p3<-1e-9||p1>1e-9||p0<-1e-9||p2>1e-9)continue;u=p3/(p3-p1);v=p0/(p0-p2);
        if(mode===2){if(!pointAtP(B,b+O_M,Math.min(1,Math.max(0,u)),Math.min(1,Math.max(0,v)),p,ar))continue;var is=1/B[b+O_SC],WX=B[b+O_C0]+(B[b+O_O]+t*dx)*is,WY=B[b+O_C0+1]+(B[b+O_O+1]+t*dy)*is,WZ=B[b+O_C0+2]+(B[b+O_O+2]+t*dz)*is,ex=p[0]-WX,ey=p[1]-WY,ez=p[2]-WZ;
          if(!(Math.sqrt(ex*ex+ey*ey+ez*ez)<=1e-6*(1+Math.sqrt(WX*WX+WY*WY+WZ*WZ))))continue}
        ok=true}}
    if(ok){var o=(Y-0.5)*W+x;if(z[o]===0||t<z[o]){z[o]=t;pid[o]=id;uq[o]=Math.round(Math.min(1,Math.max(0,u))*65535);vq[o]=Math.round(Math.min(1,Math.max(0,v))*65535);w++}}
    dx=dx+sx;dy=dy+sy;dz=dz+sz;a=a+da;da=da+dda;bb=bb+db;n0=n0+s0;n1=n1+s1;n2=n2+s2;n3=n3+s3;nwd=nwd+nws}
  return w}

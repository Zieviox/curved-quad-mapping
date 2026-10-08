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

// The step 17 pixel pass for one row of one piece (same arithmetic as spanRay mode 4 in stress-kernels.src.js). Included twice:
// once plain (timed), once with TOUCH() reporting every memory fetch to the cache model (counted).
static long SPAN(const float*B,float Y,float ox,int x0,int x1,int row,const Out*o,int id){
  TOUCH(4,B);TOUCH(4,B+16);TOUCH(4,B+32);
  float X=(x0-ox)+0.5f,A00=B[O_A],A01=B[O_A+1],A02=B[O_A+2],A11=B[O_A+3],A12=B[O_A+4],A22=B[O_A+5],cq=B[O_CQ];
  float sx=B[O_DX],sy=B[O_DX+1],sz=B[O_DX+2],dx=B[O_D0]+X*sx+Y*B[O_DY],dy=B[O_D0+1]+X*sy+Y*B[O_DY+1],dz=B[O_D0+2]+X*sz+Y*B[O_DY+2];
  float Asx=A00*sx+A01*sy+A02*sz,Asy=A01*sx+A11*sy+A12*sz,Asz=A02*sx+A12*sy+A22*sz,Adx=A00*dx+A01*dy+A02*dz,Ady=A01*dx+A11*dy+A12*dz,Adz=A02*dx+A12*dy+A22*dz;
  float a=dx*Adx+dy*Ady+dz*Adz,dd=2*(sx*Adx+sy*Ady+sz*Adz),sAs=sx*Asx+sy*Asy+sz*Asz,da=dd+sAs,dda=2*sAs,bb=B[O_BO]*dx+B[O_BO+1]*dy+B[O_BO+2]*dz,db=B[O_BO]*sx+B[O_BO+1]*sy+B[O_BO+2]*sz;
  const float*P=B+O_PL;float n0=P[0]*dx+P[1]*dy+P[2]*dz,s0=P[0]*sx+P[1]*sy+P[2]*sz,n1=P[4]*dx+P[5]*dy+P[6]*dz,s1=P[4]*sx+P[5]*sy+P[6]*sz,n2=P[8]*dx+P[9]*dy+P[10]*dz,s2=P[8]*sx+P[9]*sy+P[10]*sz,n3=P[12]*dx+P[13]*dy+P[14]*dz,s3=P[12]*sx+P[13]*sy+P[14]*sz;
  float o0=P[3],o1=P[7],o2=P[11],o3=P[15],sgn=B[O_SIG],ng=B[O_NG],nwd=B[O_NW]*dx+B[O_NW+1]*dy+B[O_NW+2]*dz,nws=B[O_NW]*sx+B[O_NW+1]*sy+B[O_NW+2]*sz;
  long w=0;float*z=o->z+(size_t)row*o->W;int16_t*pid=o->pid+(size_t)row*o->W;uint16_t*uq=o->u+(size_t)row*o->W,*vq=o->v+(size_t)row*o->W;
  for(int x=x0;x<=x1;x++){float t=-1,u=0,v=0;int ok=0;
    float D=bb*bb-4*a*cq;if(D<0&&D>-1e-9f*(bb*bb+fabsf(4*a*cq)+1e-30f))D=0;
    if(D>=0){t=fabsf(a)<1e-14f?-cq/bb:(-bb-sgn*sqrtf(D))/(2*a);
      if(t>1e-9f&&ng+t*nwd>0){float q0=o0+t*n0,q1=o1+t*n1,q2=o2+t*n2,q3=o3+t*n3;if(!(q3<-1e-9f||q1>1e-9f||q0<-1e-9f||q2>1e-9f)){u=q3/(q3-q1);v=q0/(q0-q2);ok=1;}}}
    if(ok){TOUCH(0,z+x);if(z[x]==0||t<z[x]){TOUCH(1,pid+x);TOUCH(2,uq+x);TOUCH(3,vq+x);z[x]=t;pid[x]=id;uq[x]=(uint16_t)lrintf(clamp01(u)*65535);vq[x]=(uint16_t)lrintf(clamp01(v)*65535);w++;}}
    dx+=sx;dy+=sy;dz+=sz;a+=da;da+=dda;bb+=db;n0+=s0;n1+=s1;n2+=s2;n3+=s3;nwd+=nws;}
  return w;}
// one object: every piece walks its bulge box (+1 px), drawn at (ox, oy) on the screen
static long INST(const float*B,int n,int ox,int oy,const Out*o,int idBase,long*written){long walked=0;
  for(int i=0;i<n;i++){const float*b=B+(size_t)i*PSTRIDE;TOUCH(4,b+O_WBOX);
    int x0=(int)ceilf(b[O_WBOX]-1-0.5f)+ox,x1=(int)floorf(b[O_WBOX+1]+1-0.5f)+ox,y0=(int)ceilf(b[O_WBOX+2]-1-0.5f)+oy,y1=(int)floorf(b[O_WBOX+3]+1-0.5f)+oy;
    if(x0<ox)x0=ox;if(y0<oy)y0=oy;if(x0<0)x0=0;if(y0<0)y0=0;if(x1>o->W-1)x1=o->W-1;if(y1>o->H-1)y1=o->H-1;if(x1<x0)continue;
    for(int y=y0;y<=y1;y++){walked+=x1-x0+1;ROWCLEAR(o,x0,x1);*written+=SPAN(b,(y-oy)+0.5f,(float)ox,x0,x1,ROWOF(y),o,idBase+i);}}
  return walked;}

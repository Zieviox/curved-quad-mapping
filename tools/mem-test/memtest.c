// Memory fetches: a calc against a measurement, for the step 17 pixel pass (float32, native).
//   measured: core cycles per pixel walked (time-stamp counter, scaled to core cycles by a calibration loop)
//   calc:     the log's operation model  +  every memory fetch replayed through a model of this machine's caches,
//             each fetch priced by where it is found (prices measured on this machine by separate small loops)
// usage: memtest <dir with m<mesh>_c<cell>.bin/.json>    (exported from examples/12 by tools/mem-export.js)
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <math.h>
#include <sys/mman.h>
#include <x86intrin.h>
enum{PSTRIDE=240,O_D0=0,O_DX=3,O_DY=6,O_A=9,O_BO=15,O_CQ=18,O_PL=20,O_SIG=43,O_NW=44,O_NG=47,O_WBOX=148};
typedef struct{float*z;int16_t*pid;uint16_t*u,*v;int W,H;}Out;
static inline float clamp01(float x){return x<0?0:x>1?1:x;}
// ---------------- the cache model ----------------
// L1 48 KB 12-way, L2 2 MB 16-way, L3 as given, TLB 2048 entries 8-way; least recently used within a set.
typedef struct{uint64_t*tag;uint32_t*age;int sets,ways;uint32_t clock;}Cache;
static Cache mk(long bytes,int ways,int unit){Cache c;c.ways=ways;c.sets=1;while((long)c.sets*2*ways*unit<=bytes)c.sets*=2;c.tag=malloc(sizeof(uint64_t)*c.sets*ways);c.age=calloc((size_t)c.sets*ways,4);memset(c.tag,0xff,sizeof(uint64_t)*c.sets*ways);c.clock=1;return c;}
static void wipe(Cache*c){memset(c->tag,0xff,sizeof(uint64_t)*c->sets*c->ways);memset(c->age,0,4*(size_t)c->sets*c->ways);c->clock=1;}
static inline int look(Cache*c,uint64_t key){uint64_t s=(key*0x9E3779B97F4A7C15ULL>>20)&(c->sets-1);uint64_t*t=c->tag+s*c->ways;uint32_t*a=c->age+s*c->ways;int v=0;
  for(int i=0;i<c->ways;i++){if(t[i]==key){a[i]=c->clock++;return 1;}if(a[i]<a[v])v=i;}t[v]=key;a[v]=c->clock++;return 0;}
static Cache L1,L2,L3,TLB;static int pageShift=12;
enum{E_L2,E_L3,E_RAM,E_STREAM,E_N};enum{NT=5};static const int TH[NT]={2,4,8,16,32};static long ev[NT][E_N],evPage;static uint64_t last[5];static int runlen[5];
// one fetch of a 64-byte line. A line already in L1 costs nothing extra. Otherwise it is found in L2, L3 or RAM, unless the prefetcher has it ready:
// that needs a run of consecutive lines in the same array, and the first TH lines of a run are not ready yet (counted for several TH).
static void touch(int stream,const void*p){uint64_t line=(uintptr_t)p>>6;if(line==last[stream])return;
  runlen[stream]=line==last[stream]+1?runlen[stream]+1:0;last[stream]=line;
  if(!look(&TLB,(uintptr_t)p>>pageShift))evPage++;
  int h1=look(&L1,line),h2=look(&L2,line),h3=look(&L3,line);if(h1)return;
  for(int k=0;k<NT;k++)ev[k][runlen[stream]>=TH[k]?E_STREAM:h2?E_L2:h3?E_L3:E_RAM]++;}
#define ROWOF(y) (y)
#define ROWCLEAR(o,x0,x1)
#define SPAN spanT
#define INST instT
#define TOUCH(s,p)
#include "span.inc"
#undef SPAN
#undef INST
#undef TOUCH
#define SPAN spanC
#define INST instC
#define TOUCH(s,p) touch(s,p)
#include "span.inc"
#undef SPAN
#undef INST
#undef TOUCH
#undef ROWOF
#undef ROWCLEAR
// arithmetic only: every row is written into the same one-row buffer (cleared first), so nothing leaves the L1 cache
#define ROWOF(y) 0
#define ROWCLEAR(o,x0,x1) memset((o)->z+(x0),0,((x1)-(x0)+1)*4)
#define SPAN spanA
#define INST instA
#define TOUCH(s,p)
#include "span.inc"
// ---------------- helpers ----------------
static void*big(size_t bytes,int huge){void*p=mmap(0,bytes,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);madvise(p,bytes,huge?MADV_HUGEPAGE:MADV_NOHUGEPAGE);memset(p,0,bytes);return p;}
static Out mkOut(int W,int H,int huge){size_t N=(size_t)W*H;Out o={big(N*4,huge),big(N*2,huge),big(N*2,huge),big(N*2,huge),W,H};return o;}
static void clr(Out*o){size_t N=(size_t)o->W*o->H;memset(o->z,0,N*4);memset(o->pid,0xff,N*2);}
static void freeOut(Out*o){size_t N=(size_t)o->W*o->H;munmap(o->z,N*4);munmap(o->pid,N*2);munmap(o->u,N*2);munmap(o->v,N*2);}
static uint64_t rng=88172645463325252ULL;static uint64_t xr(){rng^=rng<<13;rng^=rng>>7;rng^=rng<<17;return rng;}
static double tpc=1;
// time-stamp ticks per core cycle: a chain of multiplies, 3 cycles each (checked against a chain of adds, 1 cycle each)
static void calibrate(){double mul=1e9,add=1e9;for(int r=0;r<5;r++){uint64_t x=3,n=100000000ULL,t0=__rdtsc();for(uint64_t i=0;i<n;i++){x*=0x9E3779B97F4A7C15ULL;__asm__ volatile("":"+r"(x));}double c=(double)(__rdtsc()-t0)/n;if(c<mul)mul=c;
    x=3;t0=__rdtsc();for(uint64_t i=0;i<n;i++){x+=0x9E3779B97F4A7C15ULL;__asm__ volatile("":"+r"(x));}c=(double)(__rdtsc()-t0)/n;if(c<add)add=c;}
  tpc=mul/3;printf("{\"calib\":{\"ticksPerMul\":%.3f,\"ticksPerAdd\":%.3f,\"ticksPerCycle\":%.3f},\n",mul,add,tpc);}
// ---------------- prices: what one fetch costs on this machine, by where it is found ----------------
// independent fetches (the address does not depend on the data fetched, as in the pixel pass): one read + one write per 64-byte line
static double priceRandom(size_t bytes,int huge,long n){char*m=big(bytes,huge);size_t lines=bytes/64;double best=1e9;
  for(int r=0;r<3;r++){uint64_t s=12345+r,t0=__rdtsc();for(long i=0;i<n;i++){s=s*6364136223846793005ULL+1442695040888963407ULL;size_t k=(s>>24)%lines;m[k*64]++;}double c=(double)(__rdtsc()-t0)/n/tpc;if(c<best)best=c;}munmap(m,bytes);return best;}
static double priceSeq(size_t bytes,int huge){char*m=big(bytes,huge);size_t lines=bytes/64;double best=1e9;for(int r=0;r<3;r++){uint64_t t0=__rdtsc();for(size_t k=0;k<lines;k++)m[k*64]++;double c=(double)(__rdtsc()-t0)/lines/tpc;if(c<best)best=c;}munmap(m,bytes);return best;}
int main(int argc,char**argv){const char*dir=argv[1];calibrate();
  double base=priceRandom(16<<10,1,50000000),r2=priceRandom(1<<20,1,50000000),r3=priceRandom(64<<20,1,30000000),rR=priceRandom((size_t)1500<<20,1,20000000),r3k=priceRandom(64<<20,0,30000000),rRk=priceRandom((size_t)1500<<20,0,20000000);
  double sq=priceSeq((size_t)1500<<20,1),sqb=priceSeq(16<<10,1);
  printf("\"overlapped\":{\"L2\":%.2f,\"L3\":%.2f,\"RAM\":%.2f,\"stream\":%.2f,\"page4k_at64MB\":%.2f,\"page4k_at1500MB\":%.2f},\n\"runs\":[\n",r2-base,r3-base,rR-base,sq-sqb,r3k-r3,rRk-rR);fflush(stdout);
  L1=mk(48<<10,12,64);L2=mk(2<<20,16,64);L3=mk((long)260<<20,16,64);TLB=mk(2048,8,1);
  int first=1;struct{int W,H;}scr[]={{3840,2160},{15360,8640}};int cs[]={2160,540,135,34};
  for(int mi=0;mi<2;mi++){int mesh=mi==0?0:3;for(int ci=0;ci<4;ci++){int c=cs[ci];
    char fn[512];sprintf(fn,"%s/m%d_c%d.bin",dir,mesh,c);FILE*f=fopen(fn,"rb");if(!f)continue;fseek(f,0,SEEK_END);long sz=ftell(f);fseek(f,0,SEEK_SET);int n=sz/4/PSTRIDE;float*B=malloc(sz);if(fread(B,1,sz,f)!=(size_t)sz)return 1;fclose(f);
    double opsModel=0;sprintf(fn,"%s/m%d_c%d.json",dir,mesh,c);f=fopen(fn,"rb");char js[4096];size_t jl=fread(js,1,4095,f);js[jl]=0;fclose(f);char*mp=strstr(js,"\"model\":");if(mp)opsModel=atof(mp+8);
    // arithmetic only
    double arith=1e9;{Out S=mkOut(c+8,1,0);S.H=c;long w1=0,wk=instA(B,n,0,0,&S,0,&w1);int R=(int)(40000000/wk)+2;for(int rep=0;rep<5;rep++){uint64_t t0=__rdtsc();for(int r=0;r<R;r++){long w2=0;instA(B,n,0,0,&S,0,&w2);}double v=(double)(__rdtsc()-t0)/R/wk/tpc;if(v<arith)arith=v;}S.H=1;freeOut(&S);}
    for(int si=0;si<2;si++){int W=scr[si].W,H=scr[si].H,nx=W/c,ny=H/c,ni=nx*ny;if(ni<1)continue;
    float*Bs=big((size_t)ni*sz,0);for(int i=0;i<ni;i++)memcpy((char*)Bs+(size_t)i*sz,B,sz);
    int*ord=malloc(sizeof(int)*ni),*rnd=malloc(sizeof(int)*ni);for(int i=0;i<ni;i++)ord[i]=rnd[i]=i;for(int i=ni-1;i>0;i--){int j=xr()%(i+1),t=rnd[i];rnd[i]=rnd[j];rnd[j]=t;}
    for(int order=0;order<2;order++)for(int huge=0;huge<2;huge++){if(ni==1&&order==1)continue;if(si==1&&huge==1&&order==0)continue;const int*od=order?rnd:ord;Out O=mkOut(W,H,huge);double best=1e9;long tw=0,wr=0;
      for(int rep=0;rep<3;rep++){clr(&O);wr=0;tw=0;uint64_t t0=__rdtsc();for(int k=0;k<ni;k++){int i=od[k];tw+=instT((const float*)((const char*)Bs+(size_t)i*sz),n,(i%nx)*c,(i/nx)*c,&O,i*n,&wr);}double v=(double)(__rdtsc()-t0)/tw/tpc;if(v<best)best=v;}
      pageShift=huge?21:12;wipe(&L1);wipe(&L2);wipe(&L3);wipe(&TLB);memset(last,0,sizeof last);memset(runlen,0,sizeof runlen);
      for(int pass=(si==1);pass<2;pass++){clr(&O);memset(ev,0,sizeof ev);evPage=0;long w2=0;for(int k=0;k<ni;k++){int i=od[k];instC((const float*)((const char*)Bs+(size_t)i*sz),n,(i%nx)*c,(i/nx)*c,&O,i*n,&w2);}}
      printf("%s{\"mesh\":%d,\"W\":%d,\"H\":%d,\"cell\":%d,\"pieces\":%d,\"order\":%d,\"huge\":%d,\"walkedPerPiece\":%.0f,\"writtenPerPiece\":%.0f,\"measured\":%.2f,\"arith\":%.2f,\"ops\":%.2f,\"page\":%.3f,\"n\":[",first?"":",\n",mesh,W,H,c,ni*n,order,huge,(double)tw/(ni*n),(double)wr/(ni*n),best,arith,opsModel,1000.0*evPage/tw);
      for(int k=0;k<NT;k++)printf("%s[%.3f,%.3f,%.3f,%.3f]",k?",":"",1000.0*ev[k][E_L2]/tw,1000.0*ev[k][E_L3]/tw,1000.0*ev[k][E_RAM]/tw,1000.0*ev[k][E_STREAM]/tw);printf("]}");first=0;fflush(stdout);freeOut(&O);}
    munmap(Bs,(size_t)ni*sz);free(ord);free(rnd);}free(B);}}
  printf("\n]}\n");return 0;}

// Builds three versions of kernels.src.js: float64 (as written), float32 (every operation rounded), counted (every operation tallied).
const acorn=require('acorn'),escodegen=require('escodegen'),fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8'),names=[...src.matchAll(/^function (\w+)\(/gm)].map(m=>m[1]);
const ARITH=new Set(['+','-','*','/']),CMP=new Set(['<','>','<=','>=','===','!==','==','!=']),LIB=new Set(['cbrt','acos','cos']);
const isMath=(n,f)=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='Math'&&(!f||f.has(n.callee.property.name));
const call=(f,arg)=>({type:'CallExpression',callee:{type:'MemberExpression',object:{type:'Identifier',name:'Math'},property:{type:'Identifier',name:f},computed:false},arguments:[arg]});
const tally=(k,node)=>({type:'SequenceExpression',expressions:[{type:'UpdateExpression',operator:'++',prefix:false,argument:{type:'MemberExpression',object:{type:'Identifier',name:'OPS'},property:{type:'Identifier',name:k},computed:false}},node]});
// a × b ± c counts (and rounds) as one fused operation
function markFma(n){if(!n||typeof n!=='object')return;for(const k in n)if(k!=='_fused')markFma(n[k]);
  if(n.type==='BinaryExpression'&&(n.operator==='+'||n.operator==='-')){const m=[n.left,n.right].find(c=>c.type==='BinaryExpression'&&c.operator==='*'&&!c._fused);if(m){m._fused=true;n._fma=true}}}
function transform(n,mode){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(c=>transform(c,mode));
  const out={...n};for(const k in n)if(k!=='_fused'&&k!=='_fma'&&n[k]&&typeof n[k]==='object')out[k]=k==='left'&&n.type==='AssignmentExpression'||k==='id'||k==='params'?n[k]:transform(n[k],mode);
  if(mode==='f32'){
    if(n.type==='Literal'&&typeof n.value==='number'&&Math.fround(n.value)!==n.value)return{type:'Literal',value:Math.fround(n.value),raw:String(Math.fround(n.value))};
    if(n.type==='BinaryExpression'&&ARITH.has(n.operator)&&!n._fused)return call('fround',out);
    if(isMath(n,new Set(['sqrt','cbrt','acos','cos'])))return call('fround',out);
    return out}
  if(n.type==='BinaryExpression'){if(ARITH.has(n.operator)){if(n._fused)return out;return tally(n._fma?'fma':n.operator==='*'?'mul':n.operator==='/'?'div':'add',out)}if(CMP.has(n.operator))return tally('cmp',out)}
  if(n.type==='UnaryExpression'&&n.operator==='-'&&n.argument.type!=='Literal')return tally('neg',out);
  if(isMath(n)){const f=n.callee.property.name;if(f==='sqrt')return tally('sqrt',out);if(LIB.has(f))return tally('lib',out);if(f==='abs')return tally('max',out);
    if(f==='min'||f==='max'){let e=out;for(let i=1;i<n.arguments.length;i++)e=tally(f,e);return e}}
  return out}
const ast=acorn.parse(src,{ecmaVersion:2020});markFma(ast);
const ret='return{'+names.join(',')+'};';
const gen=mode=>escodegen.generate(transform(ast,mode),{format:{compact:true}});
const out=`// ---- kernels, float64 (as written) ----
function makeKernels64(){
${src}
${ret}}
// ---- kernels, float32: generated from the source above; every + − × ÷, √, ∛, cos, acos rounded to float32 (a × b ± c rounded once) ----
function makeKernels32(){${gen('f32')}${ret}}
// ---- kernels, counted: generated from the source above; every operation tallied into OPS ----
function makeKernelsCounted(OPS){${gen('count')}${ret}}
`;
fs.writeFileSync(process.argv[3],out);console.log('kernels:',names.join(', '));

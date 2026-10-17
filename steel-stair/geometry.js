export const VERSION='1.0.0';
export const fmt=(n,d=2)=>Number(n.toFixed(d)).toString();
export const cutName=v=>v==='normal'?'垂直斜边切口':'竖直切口';
export function calculate(input){
 const p={...input};
 for(const k of ['length','rise','height','thickness','startTrim','endTrim','count','gap']){
  if(p[k]===''||p[k]===null||p[k]===undefined||!Number.isFinite(Number(p[k])))throw Error('请完整输入所有数值，不能留空。');p[k]=Number(p[k]);
 }
 if(p.length<=0||p.length>100000||Math.abs(p.rise)>100000||p.height<=0||p.height>10000||p.thickness<=0||p.thickness>200)throw Error('长度须为 0～100000 mm，板高 0～10000 mm，板厚 0～200 mm（不含 0），高差绝对值不超过 100000 mm。');
 if(!Number.isInteger(p.count)||p.count<1||p.count>40)throw Error('分段数量须为 1～40 的整数。');
 if(p.startTrim<0||p.endTrim<0||p.gap<0)throw Error('收口退距和拼缝不得为负数。');
 if(!['vertical','normal'].includes(p.startCut)||!['vertical','normal'].includes(p.endCut))throw Error('不支持此收口形式。');
 if(!['equal','custom'].includes(p.mode))throw Error('不支持此分段方式。');
 const usable=p.length-p.startTrim-p.endTrim;
 if(usable<=0)throw Error('起止退距之和须小于水平投影长度。');
 let spans;
 if(p.mode==='custom'){
  spans=String(p.custom||'').trim().split(/[,，;；\s]+/).map(Number);
  if(spans.length!==p.count||spans.some(x=>!Number.isFinite(x)||x<=0))throw Error('自定义分段需填写与段数相同的正数，用逗号分隔。');
  if(Math.abs(spans.reduce((a,b)=>a+b,0)-usable)>0.000001)throw Error('自定义分段投影之和须等于扣除起止退距后的净投影 '+fmt(usable,6)+' mm。');
 }else spans=Array(p.count).fill(usable/p.count);
 const m=p.rise/p.length, normalHeight=p.height/Math.hypot(1,m),angle=Math.atan(m)*180/Math.PI;
 const upper=(x,cut)=>{const dx=cut==='normal'?-m*p.height/(1+m*m):0;return [x+dx,m*(x+dx)+p.height];};
 let cursor=p.startTrim;
 const parts=spans.map((span,i)=>{
  const a=cursor+(i? p.gap/2:0),b=cursor+span-(i<p.count-1?p.gap/2:0);cursor+=span;
  const left=i===0?p.startCut:'vertical',right=i===p.count-1?p.endCut:'vertical';
  const ul=upper(a,left),ur=upper(b,right);
  if(b-a<0.01||ur[0]-ul[0]<0.01)throw Error('第 '+(i+1)+' 段过窄，拼缝或斜切口使轮廓退化／交叉，请调整分段或端口。');
  const world=[[a,m*a],[b,m*b],ur,ul];
  const minX=Math.min(...world.map(v=>v[0])), minY=Math.min(...world.map(v=>v[1]));
  const points=world.map(([x,y])=>[x-minX,y-minY]);
  const width=Math.max(...points.map(v=>v[0])),height=Math.max(...points.map(v=>v[1]));
  const area=Math.abs(points.reduce((s,v,j)=>{const w=points[(j+1)%4];return s+v[0]*w[1]-w[0]*v[1];},0))/2;
  const edges=points.map((v,j)=>Math.hypot(v[0]-points[(j+1)%4][0],v[1]-points[(j+1)%4][1]));
  return {id:'P'+String(i+1).padStart(2,'0'),a,b,span,left,right,world,points,width,height,area,edges,weight:area*p.thickness*7.85e-6};
 });
 return {params:p,usable,slope:m,angle,normalHeight,parts,area:parts.reduce((s,v)=>s+v.area,0),weight:parts.reduce((s,v)=>s+v.weight,0)};
}
export function toDXF(model,selected=null){
 const lines=[];const put=(...v)=>lines.push(...v.map(String));
 put(999,'REVIEW REQUIRED - mm - NO KERF / NO BENDS - '+VERSION,0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1015',9,'$INSUNITS',70,4,9,'$MEASUREMENT',70,1,0,'ENDSEC',0,'SECTION',2,'TABLES',0,'TABLE',2,'LAYER',70,1,0,'LAYER',2,'CUT',70,0,62,7,6,'CONTINUOUS',0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES');
 let offset=0;
 for(const part of selected?[model.parts.find(x=>x.id===selected)]:model.parts){
  if(!part)throw Error('找不到分段');
  put(999,part.id+' thickness='+fmt(model.params.thickness,6)+'mm bbox='+fmt(part.width,6)+'x'+fmt(part.height,6),0,'LWPOLYLINE',100,'AcDbEntity',8,'CUT',100,'AcDbPolyline',90,4,70,1,38,0);
  for(const [x,y] of part.points)put(10,fmt(x+offset,6),20,fmt(y,6));
  offset+=part.width+100;
 }
 put(0,'ENDSEC',0,'EOF');return lines.join('\r\n')+'\r\n';
}
// Conservative local parser. Explicit labels + units only; no inferred values or geometry.
export function parseText(text){
 const specs={length:'水平投影长度|水平投影|投影长',rise:'高差',height:'竖直板高|竖向板高|板高',thickness:'板厚|厚度',startTrim:'起点退距|起始退距',endTrim:'终点退距|末端退距',gap:'拼缝|缝隙'};
 const values={},warnings=[];
 for(const [key,label] of Object.entries(specs)){
  const re=new RegExp('(?:'+label+')\\s*[:：=]?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(毫米|厘米|mm|cm|米|m)(?![a-z])','gi');
  const hits=[...text.matchAll(re)];
  if(hits.length>1){warnings.push(label.split('|')[0]+'重复出现，请手动确认');continue;}
  if(hits.length){const unit=hits[0][2].toLowerCase(); values[key]=Number(hits[0][1])*({厘米:10,cm:10,米:1000,m:1000}[unit]||1);}
 }
 const counts=[...text.matchAll(/(?:分段|分为|分成)\s*[:：=]?\s*(\d+)\s*(?:段|块)/g)];
 if(counts.length===1)values.count=Number(counts[0][1]);else if(counts.length>1)warnings.push('分段数量重复，请手动确认');
 if(/转角|折弯|圆管|弧形|螺旋/.test(text))warnings.push('含超出直跑段范围的描述，不自动处理这些结构');
 warnings.push('未识别内容不应用；未提到的字段保留原值，必须逐项确认。');
 return {values,warnings};
}

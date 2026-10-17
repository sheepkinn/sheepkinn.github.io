import {fmt,VERSION} from './geometry.js';
import {wrapDXF,MODELSPACE_OWNER} from './dxf-template.js';

const COLORS={CUT:'#f0f5f7',DIM:'#4bdce9',TEXT:'#ffe08a'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const clean=s=>String(s).replace(/[\r\n\u0000-\u001f]/g,' ').replace(/[^\x20-\x7e]/g,'?');
// One scene supplies both the SVG preview and CAD LINE/TEXT/LWPOLYLINE records.
// Dimensions are editable lines and text, not associative DIMENSION entities.
export function buildCADScene(model,selected=null){
 const parts=selected?[model.parts.find(p=>p.id===selected)]:model.parts;
 if(parts.some(p=>!p))throw Error('找不到分段');
 const scenes=parts.map(p=>{
  const entities=[],fs=Math.max(p.width,p.height,100)/24;
  const line=(a,b,layer='DIM')=>entities.push({type:'line',layer,a,b});
  const text=(value,x,y,height=fs,rotation=0,layer='TEXT')=>entities.push({type:'text',layer,value,x,y,height,rotation});
  const dimension=(a,b,offset,label)=>{
   const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),u=[dx/len,dy/len],n=[dy/len,-dx/len];
   const q=[a[0]+n[0]*offset,a[1]+n[1]*offset],r=[b[0]+n[0]*offset,b[1]+n[1]*offset];
   line([a[0]+n[0]*fs*.3,a[1]+n[1]*fs*.3],[q[0]+n[0]*fs*.4,q[1]+n[1]*fs*.4]);
   line([b[0]+n[0]*fs*.3,b[1]+n[1]*fs*.3],[r[0]+n[0]*fs*.4,r[1]+n[1]*fs*.4]);
   line(q,r);
   for(const v of [q,r])line([v[0]-(u[0]+n[0])*fs*.18,v[1]-(u[1]+n[1])*fs*.18],[v[0]+(u[0]+n[0])*fs*.18,v[1]+(u[1]+n[1])*fs*.18]);
   let angle=Math.atan2(dy,dx)*180/Math.PI;if(angle>90||angle< -90)angle+=180;
   const rad=angle*Math.PI/180,w=label.length*fs*.60;
   text(label,(q[0]+r[0])/2-Math.cos(rad)*w/2+n[0]*fs*1.3,(q[1]+r[1])/2-Math.sin(rad)*w/2+n[1]*fs*1.3,fs,angle,'DIM');
  };
  entities.push({type:'polyline',layer:'CUT',points:p.points});
  for(let i=0;i<4;i++)dimension(p.points[i],p.points[(i+1)%4],fs*2.1,`${'ABCD'[i]}${'BCDA'[i]} ${fmt(p.edges[i])}`);
  dimension([0,0],[p.width,0],fs*4.6,'W '+fmt(p.width));
  dimension([p.width,0],[p.width,p.height],fs*5.5,'H '+fmt(p.height));
  p.points.forEach(([x,y],i)=>text('ABCD'[i],x+(i===0||i===3?-fs*.8:fs*.3),y+(i<2?-fs*.9:fs*.35),fs*.8));
  const cx=p.points.reduce((a,v)=>a+v[0],0)/4,cy=p.points.reduce((a,v)=>a+v[1],0)/4;
  text(p.id,cx-fs,cy+fs*.2,fs*1.1);text('t='+fmt(model.params.thickness)+' mm',cx-fs*2,cy-fs*1.1,fs*.75);
  text(p.id+' / FLAT PLATE / mm',0,p.height+fs*4,fs*.9);
  const cut=c=>c==='normal'?'NORMAL':'VERTICAL';
  text('LEFT '+cut(p.left)+' | RIGHT '+cut(p.right),0,-fs*7,fs*.65);
  text('Station '+fmt(p.a)+' -> '+fmt(p.b)+' | slope '+fmt(model.angle)+' deg',0,-fs*8.1,fs*.65);
  text('LOCAL X/Y mm - bbox origin (0,0)',0,-fs*9.5,fs*.65);
  p.points.forEach(([x,y],i)=>text(`${'ABCD'[i]}: X ${fmt(x,3)}   Y ${fmt(y,3)}`,0,-fs*(10.6+i*1.05),fs*.65));
  const bounds=entityBounds(entities);return {entities,bounds,fs};
 });
 const gap=Math.max(...scenes.map(s=>s.fs))*2;
 const cols=Math.min(3,scenes.length),cellW=Math.max(...scenes.map(s=>s.bounds.maxX-s.bounds.minX))+gap,cellH=Math.max(...scenes.map(s=>s.bounds.maxY-s.bounds.minY))+gap;
 const entities=[];
 scenes.forEach((s,i)=>{
  const dx=(i%cols)*cellW-s.bounds.minX,dy=Math.floor(i/cols)*cellH-s.bounds.minY;
  for(const e of s.entities){if(e.type==='polyline')entities.push({...e,points:e.points.map(([x,y])=>[x+dx,y+dy])});else if(e.type==='line')entities.push({...e,a:[e.a[0]+dx,e.a[1]+dy],b:[e.b[0]+dx,e.b[1]+dy]});else entities.push({...e,x:e.x+dx,y:e.y+dy});}
 });
 let bounds=entityBounds(entities);const fs=Math.max(...scenes.map(s=>s.fs));
 const header=(value,offset)=>entities.push({type:'text',layer:'TEXT',value,x:0,y:bounds.maxY+fs*offset,height:fs*.75,rotation:0});
 header('STEEL STAIR PLATE / REVIEW ONLY / v'+VERSION,5);
 header(`L=${fmt(model.params.length)} R=${fmt(model.params.rise)} V=${fmt(model.params.height)} t=${fmt(model.params.thickness)} mm | ${parts.length} PART(S)`,3.7);
 header(`TRIM ${fmt(model.params.startTrim)} / ${fmt(model.params.endTrim)} | JOINT-X ${fmt(model.params.gap)} mm | NO KERF / NO BENDS`,2.4);
 header('LAYERS: CUT / DIM / TEXT | COORDS: LOCAL mm',1.1);
 bounds=entityBounds(entities);
 return {entities,bounds,parts:parts.map(p=>p.id),fontSize:fs};
}
export function entityBounds(entities){
 const coords=[];
 for(const e of entities){
  if(e.type==='polyline')coords.push(...e.points);else if(e.type==='line')coords.push(e.a,e.b);else{
   const w=e.value.length*e.height*.65,h=e.height*1.2,angle=e.rotation*Math.PI/180;
   for(const [x,y] of [[0,-h*.2],[w,-h*.2],[w,h],[0,h]])coords.push([e.x+x*Math.cos(angle)-y*Math.sin(angle),e.y+x*Math.sin(angle)+y*Math.cos(angle)]);
  }
 }
 return {minX:Math.min(...coords.map(p=>p[0])),maxX:Math.max(...coords.map(p=>p[0])),minY:Math.min(...coords.map(p=>p[1])),maxY:Math.max(...coords.map(p=>p[1]))};
}
export function cadSVG(scene){
 const width=scene.bounds.maxX-scene.bounds.minX,height=scene.bounds.maxY-scene.bounds.minY,sw=Math.max(width,height)/1000;
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="带尺寸 CAD 标注图，与标注 DXF 使用同一套图形">'+scene.entities.map(e=>{
  const color=COLORS[e.layer];
  if(e.type==='polyline')return `<polygon data-layer="${e.layer}" points="${e.points.map(([x,y])=>`${x},${-y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${sw*1.4}"/>`;
  if(e.type==='line')return `<line data-layer="${e.layer}" x1="${e.a[0]}" y1="${-e.a[1]}" x2="${e.b[0]}" y2="${-e.b[1]}" stroke="${color}" stroke-width="${sw*.65}"/>`;
  return `<text data-layer="${e.layer}" x="${e.x}" y="${-e.y}" fill="${color}" font-family="monospace" font-size="${e.height}" transform="rotate(${-e.rotation} ${e.x} ${-e.y})">${escape(e.value)}</text>`;
 }).join('')+'</svg>';
}
export function toAnnotatedDXF(model,selected=null){
 const scene=buildCADScene(model,selected),lines=[];let handle=0x1000;
 const put=(...v)=>lines.push(...v.map(String)),num=n=>fmt(n,6);
 for(const e of scene.entities){
  const type={polyline:'LWPOLYLINE',line:'LINE',text:'TEXT'}[e.type];
  put(0,type,5,(handle++).toString(16).toUpperCase(),330,MODELSPACE_OWNER,100,'AcDbEntity',8,e.layer);
  if(e.type==='polyline'){put(100,'AcDbPolyline',90,e.points.length,70,1);for(const [x,y] of e.points)put(10,num(x),20,num(y));}
  else if(e.type==='line')put(100,'AcDbLine',10,num(e.a[0]),20,num(e.a[1]),30,0,11,num(e.b[0]),21,num(e.b[1]),31,0);
  else put(100,'AcDbText',10,num(e.x),20,num(e.y),30,0,40,num(e.height),1,clean(e.value),50,num(e.rotation),7,'Standard',100,'AcDbText');
 }
 return wrapDXF(lines.join('\r\n')+'\r\n',scene.bounds.maxX,scene.bounds.maxY);
}

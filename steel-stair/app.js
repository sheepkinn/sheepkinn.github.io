import {calculate,toDXF,parseText,fmt,VERSION} from './geometry.js';
import {generatePDF} from './pdf.js';
const $=id=>document.getElementById(id), keys=['length','rise','height','thickness','startTrim','endTrim','startCut','endCut','count','gap','mode','custom'];
const names={length:'水平投影',rise:'高差',height:'竖直板高',thickness:'板厚',startTrim:'起点退距',endTrim:'终点退距',gap:'拼缝',count:'分段数量'};
let model=null,base=null,box=null,zoom=1,toastTimer,busy=false;
const params=()=>Object.fromEntries(keys.map(k=>[k,$(k).value]));
function toast(s){$('toast').textContent=s;$('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').style.display='none',4500);}
function invalidate(){ $('confirmDims').checked=false;$('confirmScope').checked=false; }
function updateButtons(){const yes=model&&$('confirmDims').checked&&$('confirmScope').checked&&!busy;for(const id of ['dxf','pdf','json'])$(id).disabled=!yes;}
function persist(){try{localStorage.setItem('steel-stair-v1',JSON.stringify({params:params(),job:$('job').value}));$('saveState').textContent='已在此设备自动保存';}catch{$('saveState').textContent='浏览器存储不可用，请保存参数备份';}}
function update(){
 invalidate();$('customWrap').hidden=$('mode').value!=='custom';const old=$('view').value;
 try{
  model=calculate(params());$('error').hidden=true;
  $('view').replaceChildren(new Option('安装位置总览','all'),...model.parts.map(p=>new Option(p.id+' / 独立轮廓',p.id)));
  if([...$('view').options].some(o=>o.value===old))$('view').value=old;
  $('metrics').innerHTML=[['坡角',fmt(model.angle),'°'],['垂直斜边净宽',fmt(model.normalHeight),'mm'],['分段数量',model.parts.length,'块'],['钢板理论重量',fmt(model.weight),'kg']].map(([n,v,u])=>`<div class="metric"><small>${n}</small><strong>${v}</strong><em>${u}</em></div>`).join('');
  $('parts').replaceChildren(...model.parts.map(p=>{const el=document.createElement('div');el.className='part';el.innerHTML=`<b>${p.id}</b><div><strong>${fmt(p.width)} × ${fmt(p.height)} mm</strong><small>下边投影 ${fmt(p.b-p.a)} · ${fmt(p.weight)} kg</small></div><button type="button">查看</button>`;el.querySelector('button').onclick=()=>{$('view').value=p.id;render();$('drawing').scrollIntoView({behavior:'smooth',block:'center'});};return el;}));
  render();
 }catch(e){model=null;$('metrics').replaceChildren();$('parts').innerHTML='<p class="hint">请先修正输入。</p>';$('drawing').innerHTML='<div class="empty"><span>╱</span><h3>等待完整、有效的尺寸</h3><p>所有数值项均须明确填写，零值请填 0</p></div>';$('error').hidden=false;$('error').textContent=e.message;base=box=null;}
 persist();updateButtons();
}
function render(){
 if(!model)return;const chosen=$('view').value;const part=model.parts.find(p=>p.id===chosen);const parts=part?[{...part,world:part.points}]:model.parts;
 const all=parts.flatMap(p=>p.world),xs=all.map(v=>v[0]),ys=all.map(v=>v[1]);
 if(!part){xs.push(0,model.params.length);ys.push(0,model.params.rise);}
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),range=Math.max(maxX-minX,maxY-minY,1),pad=range*.14,font=range*.025;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${part?part.id:'直跑段总览'}放样轮廓"><defs><style>.dim{stroke:#879b92;stroke-width:${range*.0014};fill:none}.lab{fill:#627a70;font-family:system-ui,sans-serif;font-size:${font}px}.id{fill:#284632;font-family:system-ui,sans-serif;font-size:${font*1.15}px;font-weight:600}</style></defs>`;
 if(!part)svg+=`<path d="M0 0 L${model.params.length} ${-model.params.rise}" stroke="#9fafae" stroke-width="${range*.0015}" stroke-dasharray="${range*.008} ${range*.004}"/>`;
 for(const [i,p] of parts.entries()){
  svg+=`<polygon points="${p.world.map(([x,y])=>x+','+-y).join(' ')}" fill="${i%2?'#e1e9d6':'#d3e4a7'}" fill-opacity=".9" stroke="#547844" stroke-width="${range*.002}"/>`;
  const cx=p.world.reduce((s,v)=>s+v[0],0)/4,cy=p.world.reduce((s,v)=>s+v[1],0)/4;
  svg+=`<text class="id" x="${cx}" y="${-cy}" text-anchor="middle" dominant-baseline="middle">${p.id}</text>`;
 }
 const dimY=-minY+pad*.5,dimX=maxX+pad*.5,dimLeft=part?minX:0,dimRight=part?maxX:model.params.length;
 svg+=`<path class="dim" d="M${dimLeft} ${-minY+pad*.15}V${dimY+pad*.08} M${dimRight} ${-minY+pad*.15}V${dimY+pad*.08} M${dimLeft} ${dimY}H${dimRight}"/>`;
 svg+=`<text class="lab" x="${(dimLeft+dimRight)/2}" y="${dimY-font*.4}" text-anchor="middle">${part?'包络宽':'水平投影 L'} ${fmt(part?part.width:model.params.length)} mm</text>`;
 svg+=`<path class="dim" d="M${maxX+pad*.15} ${-minY}H${dimX+pad*.08} M${maxX+pad*.15} ${-maxY}H${dimX+pad*.08} M${dimX} ${-minY}V${-maxY}"/>`;
 svg+=`<text class="lab" transform="translate(${dimX+font*.8} ${-(minY+maxY)/2}) rotate(-90)" text-anchor="middle">包络高 ${fmt(maxY-minY)} mm</text>`;
 if(part){part.points.forEach(([x,y],i)=>{svg+=`<text class="lab" x="${x+(i<2?-font*.6:font*.4)}" y="${-y+(i<2?font*1.3:-font*.5)}">${'ABCD'[i]}</text>`;});}
 svg+='</svg>';$('drawing').innerHTML=svg;
 base={x:minX-pad,y:-maxY-pad,w:maxX-minX+2*pad,h:maxY-minY+2*pad};fit();
 $('exportHint').textContent=part?`DXF 将只导出 ${part.id}；PDF 始终包含总览及全部 ${model.parts.length} 块。`:`DXF 将导出全部 ${model.parts.length} 块，包络间隔 100 mm；PDF 含总览与各块尺寸。`;
}
function viewbox(){const s=$('drawing').querySelector('svg');if(s&&box)s.setAttribute('viewBox',`${box.x} ${box.y} ${box.w} ${box.h}`);$('zoomLabel').textContent=Math.round(zoom*100)+'%';}
function fit(){if(!base)return;box={...base};zoom=1;viewbox();}
function scale(factor){if(!box)return;const z=Math.min(8,Math.max(.4,zoom*factor)),f=zoom/z,cx=box.x+box.w/2,cy=box.y+box.h/2;box.w*=f;box.h*=f;box.x=cx-box.w/2;box.y=cy-box.h/2;zoom=z;viewbox();}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
const filename=()=>($('job').value.trim()||'steel-stair').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_');
function assertExport(){if(!model||!$('confirmDims').checked||!$('confirmScope').checked||busy)throw Error('请先完整输入，并确认所有尺寸与使用范围。');}
$('params').addEventListener('input',update);$('params').addEventListener('submit',e=>e.preventDefault());$('job').addEventListener('input',()=>{invalidate();persist();updateButtons();});
for(const id of ['confirmDims','confirmScope'])$(id).onchange=updateButtons;
$('example').onclick=()=>{const example={length:3200,rise:1600,height:900,thickness:6,startTrim:0,endTrim:0,startCut:'vertical',endCut:'vertical',count:3,gap:0,mode:'equal',custom:''};keys.forEach(k=>$(k).value=example[k]);$('job').value='演示样件（非生产尺寸）';update();toast('已载入演示尺寸，请勿当作实际工程尺寸。');};
$('clear').onclick=()=>{keys.forEach(k=>{if($(k).tagName!=='SELECT')$(k).value='';});$('startCut').value=$('endCut').value='vertical';$('mode').value='equal';$('job').value='';update();};
$('view').onchange=render;$('plus').onclick=()=>scale(1.3);$('minus').onclick=()=>scale(1/1.3);$('fit').onclick=fit;
$('drawing').addEventListener('wheel',e=>{if(!box)return;e.preventDefault();scale(e.deltaY<0?1.12:1/1.12);},{passive:false});
const pointers=new Map();let lastDistance=null;
$('drawing').addEventListener('pointerdown',e=>{if(!box)return;$('drawing').setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastDistance=null;});
$('drawing').addEventListener('pointermove',e=>{if(!box||!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance&&d>0)scale(d/lastDistance);lastDistance=d;}else if(pointers.size===1){const r=$('drawing').getBoundingClientRect(),s=Math.max(box.w/r.width,box.h/r.height);box.x-=(e.clientX-old.x)*s;box.y-=(e.clientY-old.y)*s;viewbox();}});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])$('drawing').addEventListener(ev,e=>{pointers.delete(e.pointerId);lastDistance=null;});
$('drawing').addEventListener('keydown',e=>{if(['+','=','-','0'].includes(e.key)){e.preventDefault();if(e.key==='0')fit();else scale(e.key==='-'?1/1.3:1.3);}});
$('parse').onclick=()=>{
 const result=parseText($('natural').value),root=$('parsed');root.replaceChildren();
 const title=document.createElement('b');title.textContent=Object.keys(result.values).length?'待确认的识别结果':'没有识别到明确的带单位尺寸';root.append(title);
 const list=document.createElement('ul');for(const [k,v] of Object.entries(result.values)){const li=document.createElement('li');li.textContent=names[k]+' → '+v+(k==='count'?' 段':' mm');list.append(li);}root.append(list);
 for(const warning of result.warnings){const p=document.createElement('p');p.className='hint';p.textContent=warning;root.append(p);}
 if(Object.keys(result.values).length){const btn=document.createElement('button');btn.textContent='确认这些值，写入表单';btn.onclick=()=>{Object.entries(result.values).forEach(([k,v])=>$(k).value=v);update();root.replaceChildren();toast('已填入识别值，请确认剩余全部字段。');};root.append(btn);}
};
$('dxf').onclick=()=>{try{assertExport();download(new Blob([toDXF(model,$('view').value==='all'?null:$('view').value)],{type:'application/dxf'}),filename()+'-'+$('view').value+'-review-mm.dxf');toast('已导出 1:1 毫米轮廓，请先由工厂复核。');}catch(e){toast(e.message);}};
$('pdf').onclick=async()=>{let exportModel,job;try{assertExport();exportModel=model;job=$('job').value;busy=true;updateButtons();$('pdf').textContent='正在生成…';const blob=await generatePDF(exportModel,job);download(blob,(job.trim()||'steel-stair').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')+'-review.pdf');toast('已导出尺寸复核 PDF，纸张图形不是 1:1。');}catch(e){toast('PDF 生成失败：'+e.message);}finally{busy=false;$('pdf').textContent='↓ 尺寸 PDF';updateButtons();}};
$('json').onclick=()=>{try{assertExport();download(new Blob([JSON.stringify({schema:'steel-stair-flat-v1',version:VERSION,job:$('job').value,params:model.params,parts:model.parts,confirmedAt:new Date().toISOString(),status:'工厂复核前不可投产'},null,2)],{type:'application/json'}),filename()+'-params.json');}catch(e){toast(e.message);}};
$('load').onclick=()=>$('jsonFile').click();$('jsonFile').onchange=async()=>{const file=$('jsonFile').files[0];if(!file)return;try{if(file.size>1000000)throw Error('参数文件不能超过 1 MB');const data=JSON.parse(await file.text());if(data.schema!=='steel-stair-flat-v1'||!data.params||typeof data.job!=='string'||data.job.length>40)throw Error('不支持此参数文件格式');calculate(data.params);keys.forEach(k=>$(k).value=data.params[k]??'');$('job').value=data.job;update();toast('参数已打开，须重新确认后导出。');}catch(e){toast('打开失败：'+e.message);}finally{$('jsonFile').value='';}};
let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install').hidden=false;});$('install').onclick=async()=>{await installPrompt?.prompt();$('install').hidden=true;};
try{const saved=JSON.parse(localStorage.getItem('steel-stair-v1'));if(saved?.params){keys.forEach(k=>{if(saved.params[k]!==undefined)$(k).value=saved.params[k];});$('job').value=String(saved.job||'').slice(0,40);update();}}catch{toast('本地草稿无法读取，请重新录入。');}
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>$('saveState').textContent+=' · 离线缓存已就绪').catch(()=>{$('saveState').textContent+=' · 当前连接不支持离线缓存';});
// Exposed only for reproducible geometry/export QA; no external services or keys.
window.steelLayout={calculate,toDXF,generatePDF,getModel:()=>model};

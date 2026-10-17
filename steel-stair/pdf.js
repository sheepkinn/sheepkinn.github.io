import {fmt,cutName,VERSION} from './geometry.js';
const W=1122,H=794;
function pageCanvas(){const c=document.createElement('canvas');c.width=W*2;c.height=H*2;const x=c.getContext('2d');x.scale(2,2);x.fillStyle='#fff';x.fillRect(0,0,W,H);return {c,x};}
function text(x,s,a,b,size=13,color='#263e46'){x.fillStyle=color;x.font=`${size}px "Microsoft YaHei",system-ui,sans-serif`;x.fillText(String(s),a,b);}
function line(x,a,b,c,d,color='#82938e'){x.strokeStyle=color;x.lineWidth=1;x.beginPath();x.moveTo(a,b);x.lineTo(c,d);x.stroke();}
function header(x,job,title,page,total){text(x,'钢板放样 / 尺寸复核单',42,44,23);text(x,job||'未命名任务',42,70,14);text(x,title,690,46,16);text(x,`${page} / ${total}  ·  v${VERSION}`,950,70,12);line(x,42,88,1080,88);text(x,'待工厂复核  |  单位 mm  |  图形按页面缩放，禁止按 PDF 比例下料',42,111,13,'#99551f');}
function draw(x,parts,box){
 const all=parts.flatMap(p=>p.world), minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
 const s=Math.min((box.w-120)/(maxX-minX||1),(box.h-75)/(maxY-minY||1));
 const ox=box.x+60+(box.w-120-(maxX-minX)*s)/2,oy=box.y+box.h-40-(box.h-75-(maxY-minY)*s)/2;
 const at=([a,b])=>[ox+(a-minX)*s,oy-(b-minY)*s];
 for(const p of parts){x.beginPath();p.world.map(at).forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fillStyle='#edf3dd';x.fill();x.strokeStyle='#395a46';x.lineWidth=1.5;x.stroke();const cx=p.world.reduce((t,v)=>t+v[0],0)/4,cy=p.world.reduce((t,v)=>t+v[1],0)/4;const [a,b]=at([cx,cy]);text(x,p.id,a-14,b+4,13);}
 if(parts.length===1){const p=parts[0];p.world.forEach((v,i)=>{const a=at(v),b=at(p.world[(i+1)%4]);const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*22,ny=dx/len*22;line(x,a[0]+nx,a[1]+ny,b[0]+nx,b[1]+ny);for(const pt of [a,b])line(x,pt[0],pt[1],pt[0]+nx*1.25,pt[1]+ny*1.25);const label=`${'ABCD'[i]}${'BCDA'[i]} ${fmt(p.edges[i])}`;const tx=(a[0]+b[0])/2+nx,ty=(a[1]+b[1])/2+ny;x.save();x.translate(tx,ty);let ang=Math.atan2(dy,dx);if(ang>Math.PI/2||ang< -Math.PI/2)ang+=Math.PI;x.rotate(ang);x.fillStyle='#fff';x.fillRect(-45,-13,90,16);text(x,label,-42,-1,11);x.restore();text(x,'ABCD'[i],a[0]+(i<2?-12:5),a[1]+(i<2?16:-7),12);});}
 const a=at([minX,minY]),b=at([maxX,minY]);const y=box.y+box.h-7;line(x,a[0],y,b[0],y);for(const pt of [a,b])line(x,pt[0],pt[1]+8,pt[0],y+4);text(x,'包络宽 '+fmt(maxX-minX)+' mm',(a[0]+b[0])/2-68,y-6,12);
}
function footer(x,stamp){line(x,42,741,1080,741);text(x,'平板轮廓，无切缝补偿 / 孔位 / 折弯 / 结构校核。DXF 才是 1:1 毫米几何。',42,765,12);text(x,stamp,810,765,10);}
function keyRows(x,rows,y){for(let i=0;i<rows.length;i++){const col=i%3,row=Math.floor(i/3);text(x,rows[i],42+col*350,y+row*26,12);}}
// PDF pages embed high-resolution browser-rendered sheets, retaining installed Chinese fonts.
function imagePDF(images){
 const enc=new TextEncoder(),chunks=[],offsets=[0];let size=0;
 const add=v=>{const b=typeof v==='string'?enc.encode(v):v;chunks.push(b);size+=b.length;};
 const obj=(id,head,data)=>{offsets[id]=size;add(`${id} 0 obj\n${head}`);if(data){add('\nstream\n');add(data);add('\nendstream');}add('\nendobj\n');};
 add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
 images.forEach((data,i)=>{const id=3+i*3;obj(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`);const cmds=enc.encode('q 841.89 0 0 595.28 0 0 cm /Im0 Do Q');obj(id+1,`<< /Length ${cmds.length} >>`,cmds);obj(id+2,`<< /Type /XObject /Subtype /Image /Width ${W*2} /Height ${H*2} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>`,data);});
 const start=size,count=3+images.length*3;add(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);return new Blob(chunks,{type:'application/pdf'});
}
export async function generatePDF(model,job){
 await document.fonts.ready;const images=[],total=model.parts.length+1,stamp=new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})+' CST';
 const encode=async c=>{const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.94));images.push(new Uint8Array(await blob.arrayBuffer()));};
 let {c,x}=pageCanvas();header(x,job,'总览 / 参数确认记录',1,total);draw(x,model.parts,{x:42,y:130,w:1038,h:300});const p=model.params;
 keyRows(x,[`原始水平投影 L：${fmt(p.length)} mm`,`高差 R：${fmt(p.rise)} mm`,`竖直板高 V：${fmt(p.height)} mm`,`板厚：${fmt(p.thickness)} mm`,`坡角：${fmt(model.angle)}°`,`垂直斜边净宽：${fmt(model.normalHeight)} mm`,`起点退距：${fmt(p.startTrim)} mm`,`终点退距：${fmt(p.endTrim)} mm`,`拼缝水平投影：${fmt(p.gap)} mm`,`起口：${cutName(p.startCut)}`,`终口：${cutName(p.endCut)}`,`分段：${p.count} 段 / ${p.mode==='equal'?'等投影':'自定义'}`,`面积合计：${fmt(model.area/1e6,4)} m²`,`理论重量：${fmt(model.weight)} kg`,`净投影：${fmt(model.usable)} mm`],466);
 text(x,'分段理论投影 mm：'+model.parts.map(v=>fmt(v.span)).join(' / '),42,610,11);
 // Wrap long span lists in a constrained area.
 if(model.parts.length>12){x.fillStyle='#fff';x.fillRect(42,594,1038,36);text(x,'分段理论投影详见各分段页及参数 JSON（段数较多）',42,610,12);}
 text(x,'复核项目：现场基准、左右方向、尺寸容差、端口伸出、接缝、材质与板厚、设备切缝和套料。',42,648,13);
 text(x,'确认记录：导出前用户已勾选输入与范围确认；此记录不等同于工厂审批。未对照 LZ-221-222 7.3.dwg。',42,678,12,'#99551f');
 text(x,'工厂复核人：________________     日期：________________     备注：________________',42,710,13);footer(x,stamp);await encode(c);
 for(const [i,part] of model.parts.entries()){
  ({c,x}=pageCanvas());header(x,job,`${part.id} / 独立平板轮廓`,i+2,total);draw(x,[{...part,world:part.points}],{x:42,y:130,w:1038,h:355});
  keyRows(x,[`板厚：${fmt(p.thickness)} mm`,`包络：${fmt(part.width)} × ${fmt(part.height)} mm`,`重量：${fmt(part.weight)} kg`,`左口：${cutName(part.left)}`,`右口：${cutName(part.right)}`,`理论投影：${fmt(part.span)} mm`,`下边站位：${fmt(part.a)} → ${fmt(part.b)} mm`,`实际下边投影：${fmt(part.b-part.a)} mm`,`面积：${fmt(part.area/1e6,4)} m²`],520);
  text(x,'局部坐标 / 包络左下为 (0, 0)；A→B→C→D 为闭合轮廓顶点',42,612,13);
  part.points.forEach(([a,b],j)=>text(x,`${'ABCD'[j]}   X ${fmt(a,6)}   Y ${fmt(b,6)}`,42+(j%2)*520,642+Math.floor(j/2)*28,13));
  text(x,'AB / BC / CD / DA 为实际边长。标注四舍五入到 0.01 mm；DXF 坐标保留 0.000001 mm，不代表加工精度。',42,713,12);footer(x,stamp);await encode(c);
  await new Promise(r=>setTimeout(r,0));
 }
 return imagePDF(images);
}

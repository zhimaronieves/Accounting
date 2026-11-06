// Small, dependency-free record exports. Financial numbers stay numeric in OOXML.
const encoder=new TextEncoder();
const xml=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const bytes=s=>encoder.encode(s);
function crc32(data){let crc=0xffffffff;for(const b of data){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function zip(files){
 const parts=[],central=[];let offset=0,size=0;
 for(const [name,content] of Object.entries(files)){
  const n=bytes(name),d=bytes(content),crc=crc32(d),local=new Uint8Array(30+n.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);v.setUint16(26,n.length,true);local.set(n,30);
  const c=new Uint8Array(46+n.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,d.length,true);cv.setUint32(24,d.length,true);cv.setUint16(28,n.length,true);cv.setUint32(42,offset,true);c.set(n,46);
  parts.push(local,d);central.push(c);offset+=local.length+d.length;size+=c.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function recordSheets(model){
 return [{name:'Document',rows:[[model.company],[model.page,model.id],['Currency','PHP'],[],['Field','Value'],...model.fields.map(f=>[f.label,f.value]),...model.contactFields.map(f=>[f.label,f.value]),['Remarks',model.remarks],[],['Summary','Value (PHP)'],...[...model.summary,...(model.methodSummary||[])].map(f=>[f.label,f.value])]},...model.tables.map((t,i)=>({name:`${i+1} ${t.title}`.slice(0,31),rows:[t.columns,...t.rows]}))];
}
export function recordExcel(model){
 const sheets=recordSheets(model),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const files={
  '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  '_rels/.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/></Relationships>`,
  'xl/styles.xml':`<styleSheet xmlns="${ns}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf xfId="0"/><xf numFmtId="4" applyNumberFormat="1" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
 };
 for(const [i,s] of sheets.entries())files[`xl/worksheets/sheet${i+1}.xml`]=`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="20" width="28" customWidth="1"/></cols><sheetData>${s.rows.map((r,j)=>`<row r="${j+1}">${r.map((v,k)=>{let n=k+1,col='';while(n){n--;col=String.fromCharCode(65+n%26)+col;n=Math.floor(n/26);}const ref=col+(j+1);return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}" s="1"><v>${v}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`).join('')}</sheetData></worksheet>`;
 return zip(files);
}
const clean=s=>String(s??'').replace(/₱/g,'PHP ').replace(/[—–]/g,'-').replace(/·/g,' / ').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/→/g,' to ').replace(/…/g,'...');
const numeric=v=>typeof v==='number'?v.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}):v;
export function recordPDF(model){
 const lines=[],push=(text,bold=false)=>{for(const paragraph of clean(text).split('\n')){const words=paragraph.split(/\s+/);let line='';for(const word of words){if((line+' '+word).length>88){lines.push({text:line,bold});line='';}for(let i=0;i<word.length;i+=88){const part=word.slice(i,i+88);if(i)lines.push({text:line,bold});line=i?part:(line?line+' ':'')+part;}}lines.push({text:line,bold});}};
 push(model.company,true);push(`${model.page} / ${model.id}`,true);push('Currency: PHP / Posted source record / Read-only');push('');
 push('General Information',true);for(const f of [...model.fields,...model.contactFields])push(`${f.label}: ${f.money?numeric(f.value):f.value}`);push(`Remarks: ${model.remarks}`);push('');
 for(const t of model.tables){push(t.title,true);if(!t.rows.length)push('No recorded rows.');for(const [i,row]of t.rows.entries()){const start=lines.length;push(`Row ${i+1}`,true);row.forEach((v,j)=>push(`${t.columns[j]}: ${t.money.includes(j)?numeric(v):v}`));push('');lines[start].blockLength=lines.length-start;}}
 const summaryStart=lines.length;push('Summary (PHP)',true);for(const f of [...model.summary,...(model.methodSummary||[])])push(`${f.label}: ${f.money?numeric(f.value):f.value}`);lines[summaryStart].blockLength=lines.length-summaryStart;push('');const noteStart=lines.length;push(model.contactNote);push('Local accounting snapshot. Not a statutory tax document.');lines[noteStart].blockLength=lines.length-noteStart;
 const pages=[];let current=[];for(let i=0;i<lines.length;){const length=Math.min(lines[i].blockLength||1,48),need=length===1&&lines[i].bold?1+Math.min(lines[i+1]?.blockLength||1,47):length;if(current.length&&current.length+need>48){pages.push(current);current=[];}current.push(...lines.slice(i,i+length));i+=length;}if(current.length)pages.push(current);
 const objects=[],add=s=>(objects.push(s),objects.length);
 add('<< /Type /Catalog /Pages 2 0 R >>');add('');add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const ids=[];
 // WinAnsi text keeps Latin names intact; PHP is used because base PDF fonts lack the peso glyph.
 const escape=s=>{const text=clean(s);if(/[^\x20-\x7E\xA0-\xFF]/.test(text))throw new Error('This PDF font cannot represent a source character. Export to Excel to preserve the original text.');return text.replace(/([\\()])/g,'\\$1');};
 pages.forEach((page,i)=>{const stream=`0.06 0.09 0.16 rg\n${page.map((l,j)=>`BT /${l.bold?'F2':'F1'} ${l.bold?11:10} Tf 1 0 0 1 44 ${788-j*15} Tm (${escape(l.text)}) Tj ET`).join('\n')}\nBT /F1 9 Tf 1 0 0 1 44 32 Tm (${escape(model.id)} / Page ${i+1} of ${pages.length}) Tj ET`;
  const content=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`),id=add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${content} 0 R >>`);ids.push(id);
 });
 objects[1]=`<< /Type /Pages /Kids [${ids.map(id=>`${id} 0 R`).join(' ')}] /Count ${ids.length} >>`;
 let text='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(text.length);text+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=text.length;text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>`${String(o).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Blob([Uint8Array.from(text,c=>c.charCodeAt(0))],{type:'application/pdf'});
}
export function downloadRecord(model,format){
 const blob=format==='pdf'?recordPDF(model):recordExcel(model),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${model.id.replace(/[^\w.-]/g,'_')}.${format==='pdf'?'pdf':'xlsx'}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

type Capture = {width:number;height:number;columns:number;rows:number;fontSize:number;fps:number;seconds:number;frames:{header:string[];footer:string[]}};
const capturePath=process.argv[2];
if(!capturePath)throw Error('请提供 sample-field.mts 的浏览器采样结果路径');
const capture:Capture=JSON.parse(readFileSync(capturePath,'utf8')).value;
const {width,height,columns,rows,fontSize,fps,seconds}=capture;
const charset=' .:-=+*#%@';
const decimal=(n:number)=>Number(n.toFixed(5)).toString().replace(/^0\./,'.');
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function changes(values:string[],duration:number) {
  const entries=values.flatMap((value,i)=>i===0||value!==values[i-1]?[{value,time:i/fps/duration}]:[]);
  if(entries.length===1)return '';
  if(entries.at(-1)!.time<1)entries.push({value:entries.at(-1)!.value,time:1});
  return `<animate attributeName="href" values="${entries.map(e=>'#'+e.value).join(';')}" keyTimes="${entries.map(e=>decimal(e.time)).join(';')}" dur="${duration}s" calcMode="discrete" repeatCount="indefinite"/>`;
}
function typing(length:number,delay:number,step:number) {
  const duration=delay+length*step;
  return `<animate attributeName="width" values="${Array.from({length:length+1},(_,i)=>i).join(';')}" keyTimes="${Array.from({length:length+1},(_,i)=>i===0?'0':decimal((delay+i*step)/duration)).join(';')}" calcMode="discrete" dur="${duration}s" fill="freeze"/>`;
}
function textLine(text:string,font:number,baseline:number,delay:number,step:number,id:string) {
  const glyph=font*.6, x=(width-text.length*glyph)/2;
  const duration=delay+text.length*step;
  return `<g transform="translate(${decimal(x)} ${baseline})"><defs><clipPath id="${id}"><rect x="0" y="-${font}" width="${text.length}" height="${font*1.3}" transform="scale(${glyph} 1)">${typing(text.length,delay,step)}</rect></clipPath></defs><text clip-path="url(#${id})" font-size="${font}" textLength="${decimal(text.length*glyph)}" lengthAdjust="spacingAndGlyphs">${escape(text)}</text><rect class="cursor" x="0" y="-${font*.82}" width="${font*.16}" height="${font}"><animate attributeName="x" values="${Array.from({length:text.length+1},(_,i)=>decimal(i*glyph)).join(';')}" keyTimes="${Array.from({length:text.length+1},(_,i)=>i===0?'0':decimal((delay+i*step)/duration)).join(';')}" dur="${duration}s" calcMode="discrete" fill="freeze"/><animate attributeName="visibility" values="hidden;visible;hidden" keyTimes="0;${decimal(delay/(duration+.72))};1" dur="${duration+.72}s" fill="freeze"/></rect></g>`;
}
for(const name of ['header','footer'] as const) {
  const frames=capture.frames[name];
  if(frames.length!==seconds*fps+1||frames.some(f=>f.length!==columns*rows))throw Error('字符序列尺寸不匹配');
  const defs=Array.from({length:20},(_,state)=>`<text id="${String.fromCharCode(65+state)}" x="0" y="0" textLength="${decimal(width/columns)}" lengthAdjust="spacingAndGlyphs">${charset[state%10]}</text>`).join('');
  const streams=new Map<string,string>();
  const streamDefs:string[]=[];
  const rowGroups=Array.from({length:rows},(_,row)=>{
    const p=row*fontSize/height;
    const logoColor=`rgb(${Math.round(255-36*p)} ${Math.round(222+19*p)} ${Math.round(241+14*p)})`;
    const cells=Array.from({length:columns},(_,column)=>{
      const index=row*columns+column, states=frames.map(frame=>frame[index]);
      if(states.every(s=>s==='A'))return '';
      // Logo 掩膜固定：同格的颜色不需要逐帧插值，只更新来自着色器的字符等级。
      const isLogo=states.some(s=>s.charCodeAt(0)>=75);
      const signature=states.join('');
      let stream=streams.get(signature);
      if(!stream){
        stream='s'+streams.size;
        streams.set(signature,stream);
        streamDefs.push(`<use id="${stream}" href="#${states[0]}">${changes(states,seconds)}</use>`);
      }
      return `<use x="${decimal(column*width/columns)}" href="#${stream}"${isLogo?` fill="${logoColor}" fill-opacity="1"`:''}/>`;
    }).join('');
    return `<g transform="translate(0 ${decimal(row*fontSize+fontSize*.82)})">${cells}</g>`;
  }).join('');
  const title=name==='header'?'HELLO WORLD':'END';
  const subtitle=name==='header'?"I'm Lang Tan":'Curiosity makes knowledge a game.';
  const subtitleDelay=.38+title.length*.1+.72;
  const text=textLine(title,72,name==='header'?127:218,.38,.1,'primary')+textLine(subtitle,name==='header'?36:32,name==='header'?192:119,subtitleDelay,.11,'secondary');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="854" height="300" viewBox="0 0 854 300" role="img" aria-labelledby="title desc"><title id="title">${escape(title)} / ${escape(subtitle)}</title><desc id="desc">个人网站原始着色器的 24 秒字符序列；${name==='footer'?'Logo 随同一波纹场显现。':'不含 Logo。'}</desc><style>.field{font-family:Consolas,'Liberation Mono',monospace;font-size:${decimal(fontSize)}px;fill:#f6f6f6;fill-opacity:.82}.copy{font-family:Consolas,'Liberation Mono',monospace;fill:#f6f6f6}.cursor{animation:blink .85s step-end infinite}@keyframes blink{50%{opacity:0}}.still{display:none}@media(prefers-reduced-motion:reduce){.moving{display:none}.still{display:inline}.copy text{clip-path:none}.cursor{display:none}}</style><defs>${defs}${streamDefs.join('')}</defs><rect width="854" height="300" fill="#000"/><g class="field moving">${rowGroups}</g><g class="field still">${Array.from({length:rows},(_,row)=>`<text y="${decimal(row*fontSize+fontSize*.82)}" xml:space="preserve" textLength="854" lengthAdjust="spacingAndGlyphs">${escape(Array.from(frames[0].slice(row*columns,(row+1)*columns),s=>charset[(s.charCodeAt(0)-65)%10]).join(''))}</text>`).join('')}</g><g class="copy">${text}</g></svg>`;
  writeFileSync(new URL(`../assets/ascii-${name}.svg`,import.meta.url),svg);
  console.log(`${name}: ${svg.length} bytes; gzip ${gzipSync(svg).length} bytes; ${frames.length} shader samples`);
}

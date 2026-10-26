/** 在浏览器内直接执行个人网站原始着色器，导出每格字符，不导出位图。 */
export async function sampleField(input: { fragment: string; logo: string }) {
  const width = 854, height = 300, resolution = 1.05 / 6;
  const columns = Math.floor(width * resolution), sampleHeight = Math.floor(height * resolution);
  const rows = Math.ceil(sampleHeight / 2), fps = 12, seconds = 24;
  const canvas = document.createElement('canvas');
  canvas.width = columns; canvas.height = sampleHeight;
  const gl = canvas.getContext('webgl', {antialias: false, preserveDrawingBuffer: true});
  if (!gl) throw new Error('生成横幅需要 WebGL');
  function compile(kind: number, source: string) {
    const shader = gl!.createShader(kind)!;
    gl!.shaderSource(shader, source); gl!.compileShader(shader);
    if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw Error(gl!.getShaderInfoLog(shader) ?? '着色器编译失败');
    return shader;
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 vUv; void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}'));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, input.fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program) ?? '链接失败');
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(program,'uResolution'),width,height);
  gl.uniform2f(gl.getUniformLocation(program,'uLogoScale'),288 / width,288 / height);
  gl.uniform1f(gl.getUniformLocation(program,'uLogoStrength'),1);
  gl.uniform1f(gl.getUniformLocation(program,'uProgress'),1);
  const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const image = new Image(); image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(input.logo);
  await image.decode();
  const mask = document.createElement('canvas'); mask.width=512;mask.height=512;
  const ctx = mask.getContext('2d')!; ctx.fillStyle='#000';ctx.fillRect(0,0,512,512);ctx.drawImage(image,0,0,512,512);
  const pixels = new Uint8Array(columns * sampleHeight * 4);
  const frames: {header: string[];footer: string[]} = {header: [], footer: []};
  for (const footer of [false,true]) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (footer) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,mask);
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    for(let frame=0;frame<=seconds*fps;frame++) {
      gl.uniform1f(gl.getUniformLocation(program,'uTime'),frame/fps);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.readPixels(0,0,columns,sampleHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let states='';
      for(let y=0;y<sampleHeight;y+=2)for(let x=0;x<columns;x++){
        const offset=((sampleHeight-1-y)*columns+x)*4;
        const glyph=Math.min(9,Math.round(pixels[offset]/255*9));
        const isLogo=pixels[offset+1]>10&&pixels[offset]>10;
        states+=String.fromCharCode(65+glyph+(isLogo?10:0));
      }
      frames[footer?'footer':'header'].push(states);
    }
  }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return {width,height,columns,rows,fontSize:2/resolution,fps,seconds,frames};
}

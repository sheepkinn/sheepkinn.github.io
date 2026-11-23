/* Independent renderer, adapted from observed 333 South Wabash entrance geometry.
 * No original site runtime, texture, framework, network request or build step. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const canvas = $("tunnel"),
    gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) {
    parent.postMessage("sheepkinn-entrance-skip", location.origin);
    return;
  }
  const I = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function mul(a, b) {
    const c = new Float32Array(16);
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < 4; k++) c[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k];
    return c;
  }
  const translate = (m, x, y, z = 0) => {
    const a = I();
    a[12] = x;
    a[13] = y;
    a[14] = z;
    return mul(m, a);
  };
  const scale = (m, x, y, z = 1) => {
    const a = I();
    a[0] = x;
    a[5] = y;
    a[10] = z;
    return mul(m, a);
  };
  function rotate(m, axis, r) {
    const a = I(),
      c = Math.cos(r),
      s = Math.sin(r);
    if (axis === "x") {
      a[5] = c;
      a[6] = s;
      a[9] = -s;
      a[10] = c;
    } else {
      a[0] = c;
      a[1] = s;
      a[4] = -s;
      a[5] = c;
    }
    return mul(m, a);
  }
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
    return s;
  }
  const pg = gl.createProgram();
  gl.attachShader(
    pg,
    shader(
      gl.VERTEX_SHADER,
      `attribute vec3 position;attribute vec2 uv;uniform mat4 projection;uniform mat4 view;uniform mat4 model;uniform float textScale;uniform float shift;varying vec2 vUv;void main(){gl_Position=projection*view*model*vec4(position,1.);vUv=vec2(uv.x*textScale+shift,uv.y);}`,
    ),
  );
  gl.attachShader(
    pg,
    shader(
      gl.FRAGMENT_SHADER,
      `precision highp float;uniform sampler2D tex;varying vec2 vUv;void main(){float a=texture2D(tex,vUv).a;if(vUv.x<0.||vUv.x>1.)a=0.;gl_FragColor=mix(vec4(0.133333,0.129412,0.121569,1.),vec4(0.933333,0.921569,0.890196,1.),a);}`,
    ),
  );
  gl.linkProgram(pg);
  if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(pg));
  gl.useProgram(pg);
  const uniforms = {};
  for (const n of ["projection", "view", "model", "textScale", "shift", "tex"])
    uniforms[n] = gl.getUniformLocation(pg, n);
  function attribute(name, data, size) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pg, name);
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, size, gl.FLOAT, false, 0, 0);
  }
  attribute("position", [0, -1, 0, 1, -1, 0, 0, 0, 0, 1, 0, 0], 3);
  attribute("uv", [0, 1, 1, 1, 0, 0, 1, 0], 2);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const anisotropy = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropy)
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)),
    );
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(34 / 255, 33 / 255, 31 / 255, 1);
  gl.uniform1i(uniforms.tex, 0);
  const state = { main: "SHEEPKINN", side: "JOURNAL", font: "Archivo", weight: 900, speed: 1 };
  let notified = false;
  let planes = [],
    firstWidth = 1214,
    lastWidth = 596,
    textureW = 2048,
    textureH = 180,
    elapsed = 0,
    paused = false,
    lastTime = 0,
    ready = false,
    raf = 0;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  // Numerically solve cubic-bezier(.87,0,.13,1), matching original timing.
  function ease(x) {
    x = clamp(x);
    let lo = 0,
      hi = 1,
      t = x;
    for (let i = 0; i < 18; i++) {
      t = (lo + hi) / 2;
      const f = 3 * (1 - t) * (1 - t) * t * 0.87 + 3 * (1 - t) * t * t * 0.13 + t * t * t;
      if (f < x) lo = t;
      else hi = t;
    }
    return 3 * (1 - t) * t * t + t * t * t;
  }
  async function makeTexture() {
    await document.fonts.load(`${state.weight} 180px ${state.font}`);
    const c = document.createElement("canvas"),
      ctx = c.getContext("2d");
    c.width = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    c.height = 512;
    const font = `${state.weight} 180px ${state.font}, Arial, 'Microsoft YaHei', sans-serif`;
    ctx.font = font;
    const a = state.main + " ",
      b = state.side;
    const metrics = ctx.measureText(a + b);
    const ascent = metrics.actualBoundingBoxAscent || 130,
      descent = metrics.actualBoundingBoxDescent || 0;
    firstWidth = ctx.measureText(a).width;
    lastWidth = Math.max(ctx.measureText(b).width, 60);
    textureW = firstWidth + lastWidth;
    textureH = ascent + descent + 4;
    // Power-of-two backing texture enables mipmaps; logical dimensions stay in CSS units.
    ctx.setTransform(c.width / textureW, 0, 0, c.height / textureH, 0, 0);
    ctx.font = font;
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(a + b, 0, ascent + 2);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    $("headline").textContent = state.main + " " + state.side + ".";
    $("headline").style.fontFamily = state.font;
    $("headline").style.fontWeight = state.weight;
    resize();
  }
  function resize() {
    const screenW = innerWidth,
      screenH = innerHeight,
      portrait = screenH > screenW,
      dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(screenW * dpr);
    canvas.height = Math.round(screenH * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const near = 1,
      far = 10000,
      f = 1 / Math.tan(Math.PI / 6),
      p = new Float32Array(16);
    p[0] = portrait ? f : f / (screenW / screenH);
    p[5] = portrait ? f * (screenW / screenH) : f;
    p[10] = (far + near) / (near - far);
    p[11] = -1;
    p[14] = (2 * far * near) / (near - far);
    gl.uniformMatrix4fv(uniforms.projection, false, p);
    gl.uniformMatrix4fv(
      uniforms.view,
      false,
      translate(
        I(),
        -screenW / 2,
        screenH / 2,
        -(portrait ? screenW : screenH) / 2 / Math.tan(Math.PI / 6),
      ),
    );
    // Lay out in landscape, then rotate the complete scene clockwise for portrait.
    // Keep camera distance identical to the virtual landscape camera so perspective
    // remains a true 90-degree rotation instead of stretching the shorter text wall.
    const w = portrait ? screenH : screenW,
      h = portrait ? screenW : screenH;
    const mainIsLonger = firstWidth >= lastWidth,
      fw = Math.max(firstWidth, lastWidth),
      fh = Math.min(firstWidth, lastWidth);
    const scene = portrait ? rotate(translate(I(), screenW, 0), "z", -Math.PI / 2) : I();
    let l,
      c,
      pH,
      d,
      ox = 0,
      oy = 0;
    if (fh / fw > h / w) {
      l = w;
      c = (l * textureH) / fw;
      d = c;
      pH = (d * fh) / textureH;
      oy = (h - pH) / 2;
    } else {
      pH = h;
      d = (pH * textureH) / fh;
      c = d;
      l = (c * fw) / textureH;
      ox = (w - l) / 2;
    }
    planes = [];
    const a = Math.PI / 2;
    for (let i = 0; i < 28; i++) {
      const group = Math.floor(i / 7),
        n = i % 7;
      let x = 0,
        y = 0,
        pw = l,
        ph = c,
        origin = [0, 0],
        rot = 0,
        tx = 0,
        ty = 0;
      if (group === 0) {
        origin = [l / 2, 0];
        rot = -2 * a;
        ty = c * (n + 1);
      }
      if (group === 1) {
        y = pH - c;
        origin = [0, pH];
        ty = n === 0 ? 0 : c * n;
      }
      if (group === 2) {
        pw = pH;
        ph = d;
        rot = -a;
        ty = d * (n + 1);
      }
      if (group === 3) {
        x = l;
        pw = pH;
        ph = d;
        origin = [l, 0];
        rot = a;
        tx = -pH;
        ty = n === 0 ? c : d * (n + 1);
      }
      let m = translate(I(), ox, -oy);
      m = translate(m, origin[0], -origin[1]);
      m = rotate(m, "z", rot);
      m = rotate(m, "x", -a);
      m = translate(m, tx, ty);
      m = translate(m, -origin[0], origin[1]);
      m = translate(m, x, -y);
      m = scale(m, pw, ph, 0);
      const useMain = group < 2 === mainIsLonger;
      planes.push({
        matrix: mul(scene, m),
        scale: (useMain ? firstWidth : lastWidth) / textureW,
        offset: useMain ? 0 : firstWidth / textureW,
      });
    }
  }
  function draw(time) {
    if (!ready) return;
    if (!paused) elapsed += (time - lastTime) * state.speed;
    lastTime = time;
    const t = elapsed;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const loadOpacity = 1 - clamp((t - 650) / 400);
    $("loader").style.opacity = loadOpacity;
    $("loader").hidden = t > 1100;
    for (let i = 0; i < planes.length; i++) {
      const p = planes[i],
        delay = (i % 7) * 250;
      const disappear = ease((t - 850 - delay) / 2600),
        appear = ease((t - 850 - delay - 3850) / 2600);
      gl.uniformMatrix4fv(uniforms.model, false, p.matrix);
      gl.uniform1f(uniforms.textScale, p.scale);
      gl.uniform1f(uniforms.shift, 1 - appear - disappear + p.offset);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    if (t >= 8550 && !notified) {
      notified = true;
      parent.postMessage("sheepkinn-entrance-complete", location.origin);
    }
    const reveal = clamp((t - 8550) / 1200);
    canvas.style.opacity = String(1 - reveal);
    canvas.style.visibility = reveal === 1 ? "hidden" : "visible";
    // A single bounded frame loop: resume/replay schedules work as needed.
    if (!paused && t < 9900) raf = requestAnimationFrame(draw);
    else raf = 0;
  }
  function replay() {
    cancelAnimationFrame(raf);
    elapsed = 0;
    paused = false;
    lastTime = performance.now();
    canvas.style.transition = "none";
    canvas.style.opacity = "1";
    canvas.style.visibility = "visible";
    $("loader").hidden = false;
    $("pause").textContent = "暂停";
    raf = requestAnimationFrame(draw);
  }
  function togglePause() {
    paused = !paused;
    $("pause").textContent = paused ? "继续" : "暂停";
    if (paused) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      lastTime = performance.now();
      raf = requestAnimationFrame(draw);
    }
  }
  function readInputs() {
    state.main = $("mainText").value.trim() || "BUILT TO BE";
    state.side = $("sideText").value.trim() || "BOLD";
    state.font = $("font").value;
    state.weight = Number($("weight").value);
    state.speed = Number($("speed").value);
  }
  function setInputs() {
    for (const [id, key] of [
      ["mainText", "main"],
      ["sideText", "side"],
      ["font", "font"],
      ["weight", "weight"],
      ["speed", "speed"],
    ])
      $(id).value = state[key];
    $("weightValue").value = state.weight;
    $("speedValue").value = state.speed.toFixed(1) + "×";
    $("weight").disabled = state.font === "Archivo";
  }
  const params = new URLSearchParams(location.hash.slice(1));
  for (const key of ["main", "side"])
    if (params.get(key)) state[key] = params.get(key).slice(0, key === "main" ? 48 : 32);
  if (["Archivo", "InterTight"].includes(params.get("font"))) state.font = params.get("font");
  for (const key of ["weight", "speed"])
    if (params.has(key)) {
      const n = Number(params.get(key));
      if (Number.isFinite(n))
        state[key] =
          key === "weight" ? Math.max(400, Math.min(900, n)) : Math.max(0.5, Math.min(2, n));
    }
  setInputs();
  $("edit").onclick = () => {
    $("editor").hidden = !$("editor").hidden;
  };
  $("close").onclick = () => {
    $("editor").hidden = true;
  };
  $("replay").onclick = replay;
  $("pause").onclick = togglePause;
  $("apply").onclick = async () => {
    const button = $("apply");
    button.disabled = true;
    try {
      readInputs();
      await makeTexture();
      $("editor").hidden = true;
      replay();
    } finally {
      button.disabled = false;
    }
  };
  $("font").onchange = () => {
    $("weight").disabled = $("font").value === "Archivo";
  };
  $("weight").oninput = () => {
    $("weightValue").value = $("weight").value;
  };
  $("speed").oninput = () => {
    $("speedValue").value = Number($("speed").value).toFixed(1) + "×";
    state.speed = Number($("speed").value);
  };
  $("copy").onclick = async () => {
    readInputs();
    const hash = new URLSearchParams(state).toString();
    history.replaceState(null, "", "#" + hash);
    try {
      await navigator.clipboard.writeText(location.href);
      $("copy").textContent = "已复制";
    } catch {
      $("copy").textContent = "链接已更新";
    }
    setTimeout(() => {
      $("copy").textContent = "复制当前链接";
    }, 1800);
  };
  addEventListener("resize", () => {
    resize();
    if (ready && !raf) {
      lastTime = performance.now();
      draw(lastTime);
    }
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") $("editor").hidden = true;
    if (
      e.code === "Space" &&
      !["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(document.activeElement.tagName)
    ) {
      e.preventDefault();
      togglePause();
    }
  });
  document.addEventListener("visibilitychange", () => {
    lastTime = performance.now();
  });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") parent.postMessage("sheepkinn-entrance-skip", location.origin);
  });
  canvas.addEventListener("webglcontextlost", () =>
    parent.postMessage("sheepkinn-entrance-skip", location.origin),
  );
  // Expose a tiny integration API; text input always goes through Canvas, never HTML.
  window.TypeTunnel = {
    async play(options = {}) {
      Object.assign(state, options);
      state.main = String(state.main || "BUILT TO BE").slice(0, 48);
      state.side = String(state.side || "BOLD").slice(0, 32);
      state.font = ["Archivo", "InterTight"].includes(state.font) ? state.font : "Archivo";
      state.speed = Math.max(0.5, Math.min(2, Number(state.speed) || 1));
      state.weight = Math.max(400, Math.min(900, Number(state.weight) || 900));
      setInputs();
      await makeTexture();
      replay();
    },
    pause: togglePause,
    getState: () => ({ ...state, elapsed, paused, planes: planes.length }),
  };
  makeTexture()
    .then(() => {
      ready = true;
      replay();
    })
    .catch((error) => {
      $("error").hidden = false;
      $("error").textContent = "动画初始化失败：" + error.message;
      parent.postMessage("sheepkinn-entrance-skip", location.origin);
    });
})();


  precision highp float;

  uniform sampler2D uLogo;
  uniform float uProgress;
  uniform float uTime;
  uniform float uLogoStrength;
  uniform vec2 uResolution;
  uniform vec2 uLogoScale;
  varying vec2 vUv;

  float hash21(vec2 value) {
    vec3 p3 = fract(vec3(value.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec2 hash22(vec2 point) {
    point = vec2(
      dot(point, vec2(127.1, 311.7)),
      dot(point, vec2(269.5, 183.3))
    );
    return -1.0 + 2.0 * fract(sin(point) * 43758.5453123);
  }

  float simplexNoise(vec2 point) {
    const float skew = 0.366025404;
    const float unskew = 0.211324865;

    vec2 cell = floor(point + (point.x + point.y) * skew);
    vec2 localA = point - cell + (cell.x + cell.y) * unskew;
    vec2 corner = localA.x > localA.y
      ? vec2(1.0, 0.0)
      : vec2(0.0, 1.0);
    vec2 localB = localA - corner + unskew;
    vec2 localC = localA - 1.0 + 2.0 * unskew;

    vec3 weight = max(
      0.5 - vec3(
        dot(localA, localA),
        dot(localB, localB),
        dot(localC, localC)
      ),
      0.0
    );
    vec3 contribution = weight * weight * weight * weight * vec3(
      dot(localA, hash22(cell)),
      dot(localB, hash22(cell + corner)),
      dot(localC, hash22(cell + 1.0))
    );

    return dot(contribution, vec3(70.0));
  }

  float fbm(vec2 point) {
    float value = 0.0;
    float amplitude = 0.62;
    float frequency = 1.0;

    // Two octaves are enough at ASCII resolution. The previous three-octave
    // field was evaluated five times per cell and dominated the shader cost.
    for (int octave = 0; octave < 2; octave++) {
      value += amplitude * simplexNoise(point * frequency);
      frequency *= 2.0;
      amplitude *= 0.48;
    }

    return value * 0.5 + 0.5;
  }

  vec2 fluidWarp(vec2 uv, float time) {
    return vec2(
      fbm(uv * 0.54 + vec2(0.0, 0.18 * time)),
      fbm(uv * 0.54 + vec2(1.2, -0.26 * time))
    );
  }

  float backgroundGlyphLevel(float density) {
    // Background ripples occupy visible indices 1..7 in
    // " .:-=+*#%@": . -> : -> - -> = -> + -> * -> #.
    float glyphIndex = floor(clamp(density, 0.0, 0.999) * 7.0) + 1.0;
    return glyphIndex / 9.0;
  }

  float boostGlyphLevel(float backgroundLevel) {
    // Logo intersections advance exactly two glyph levels:
    // . -> -, : -> =, - -> +, = -> *, + -> #, * -> %, # -> @.
    return min(1.0, backgroundLevel + 2.0 / 9.0);
  }

  float logoMaskAt(vec2 uv) {
    vec2 logoUv = (uv - 0.5) / uLogoScale + 0.5;
    float inside = step(0.0, logoUv.x) * step(logoUv.x, 1.0)
      * step(0.0, logoUv.y) * step(logoUv.y, 1.0);
    float mask = texture2D(uLogo, clamp(logoUv, 0.0, 1.0)).r;
    return smoothstep(0.06, 0.58, mask) * inside;
  }

  void main() {
    vec2 asciiGrid = vec2(
      max(uResolution.x * 0.14, 1.0),
      max(uResolution.y * 0.07, 1.0)
    );
    vec2 cell = floor(vUv * asciiGrid);
    vec2 cellUv = (cell + 0.5) / asciiGrid;

    // The background remains a live thresholded Simplex/FBM field during the
    // whole sequence, including ready. Only its prominence is reduced after
    // the logo settles; the motion itself never stops.
    float time = uTime * 0.16;
    vec2 warp = fluidWarp(cellUv, time);
    vec2 flowVector = (warp - 0.5) * vec2(0.44, 1.32) * 2.0;
    float flowBuild = smoothstep(0.12, 0.60, uProgress);
    float flowResolve = smoothstep(0.72, 1.00, uProgress);
    float flowStrength = mix(0.016, 0.050, flowBuild)
      * mix(1.0, 0.68, flowResolve);
    vec2 sampledUv = cellUv - flowVector * flowStrength;

    // Reuse the already computed warp instead of calling fluidWarp again.
    // This reduces the field from five FBM evaluations to three per cell.
    float fluid = fbm(sampledUv * 0.58 + warp * 2.65);
    float fluidBrightness = smoothstep(0.30, 0.82, fluid);
    float stableRandom = hash21(cell + vec2(11.3, 7.7));
    float capturePhase = smoothstep(0.50, 0.90, uProgress);
    float logoReveal = smoothstep(0.16, 0.42, uProgress);

    // Fewer background cells survive after the logo settles, but surviving
    // cells keep their density glyph instead of being dimmed back to dots.
    float dynamicThreshold =
      0.58 - stableRandom * 0.10 + capturePhase * 0.045;
    float thresholdExcess = smoothstep(
      dynamicThreshold,
      1.0,
      fluidBrightness
    );
    float backgroundPresence = smoothstep(
      dynamicThreshold,
      dynamicThreshold + 0.035,
      fluidBrightness
    );
    float breath = 0.94 + 0.06 * sin(uTime * 0.40 + fluid * 4.0);
    float backgroundDensity = clamp(
      pow(thresholdExcess, 0.52) * breath,
      0.0,
      1.0
    );
    float backgroundLevel = backgroundGlyphLevel(backgroundDensity);
    float backgroundSignal = backgroundPresence * backgroundLevel;

    // The logo is revealed by the same occupied ripple field that produces the
    // background glyphs. Using the full presence field avoids hollow contour
    // bands: bright wave peaks remain filled instead of disappearing between
    // narrow luminance isolines.
    float resolvedLogo = logoMaskAt(cellUv);
    float logoPresence = backgroundPresence * logoReveal;

    // The logo inherits the exact glyph under the ripple and advances it by
    // two levels: . -> -, : -> =, - -> +, = -> *, + -> #, * -> %, # -> @.
    float logoLevel = boostGlyphLevel(backgroundLevel) * uLogoStrength;
    float logoSignal = resolvedLogo * logoPresence * logoLevel;

    // Replace only the occupied overlap. Cells without a ripple are already
    // empty because backgroundPresence is zero, so there is no need to carve
    // the entire logo mask out of the background and create black cavities.
    backgroundSignal *= 1.0 - resolvedLogo * logoPresence;

    // Encode the two visible text layers plus an invisible revealed-Logo mask.
    // R is the visible glyph level, G marks occupied Logo glyphs, and B keeps
    // the Logo mask available even where the ripple is currently empty.
    float pointerLogoMask = resolvedLogo * logoReveal;
    vec3 backgroundColor = vec3(backgroundSignal, 0.0, pointerLogoMask);
    vec3 logoEncoding = vec3(logoSignal, logoPresence, pointerLogoMask);
    float hasLogo = step(0.001, logoSignal);
    vec3 finalColor = mix(backgroundColor, logoEncoding, hasLogo);
    gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
  }

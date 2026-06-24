uniform sampler2D tDiffuse;
uniform sampler2D depthTexture;
uniform sampler2D normalTexture;
uniform sampler2D samplerTexture;
uniform sampler2D lineTexture;
uniform sampler2D horizontalLineTexture;
uniform sampler2D verticalLineTexture;
uniform sampler2D baseColorTexture;
uniform vec2 resolution;
uniform float uIntensity;
uniform float uScalar;
varying vec2 vUv;

struct BrightnessStep {
    float b1;
    float b2;
    float b3;
};

uniform BrightnessStep brightnessStep;

//	Classic Perlin 2D Noise 
//	by Stefan Gustavson (https://github.com/stegu/webgl-noise)
//
vec2 fade(vec2 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float cnoise(vec2 P) {
    vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
    vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
    Pi = mod(Pi, 289.0); // To avoid truncation effects in permutation
    vec4 ix = Pi.xzxz;
    vec4 iy = Pi.yyww;
    vec4 fx = Pf.xzxz;
    vec4 fy = Pf.yyww;
    vec4 i = permute(permute(ix) + iy);
    vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41 = 0.024...
    vec4 gy = abs(gx) - 0.5;
    vec4 tx = floor(gx + 0.5);
    gx = gx - tx;
    vec2 g00 = vec2(gx.x, gy.x);
    vec2 g10 = vec2(gx.y, gy.y);
    vec2 g01 = vec2(gx.z, gy.z);
    vec2 g11 = vec2(gx.w, gy.w);
    vec4 norm = 1.79284291400159 - 0.85373472095314 *
        vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
    g00 *= norm.x;
    g01 *= norm.y;
    g10 *= norm.z;
    g11 *= norm.w;
    float n00 = dot(g00, vec2(fx.x, fy.x));
    float n10 = dot(g10, vec2(fx.y, fy.y));
    float n01 = dot(g01, vec2(fx.z, fy.z));
    float n11 = dot(g11, vec2(fx.w, fy.w));
    vec2 fade_xy = fade(Pf.xy);
    vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
    float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
    return 2.3 * n_xy;
}
// 获取颜色的亮度
// https://stackoverflow.com/questions/12043187/how-to-check-if-hex-color-is-too-black
// http://www.w3.org/TR/AERT#color-contrast
float getBrightness(vec3 color) {
    return (color.r * 299. + color.g * 587. + color.b * 114.) / (1000.);
}

void main() {

    vec2 noiseUv = vUv;

    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

    // float size = 30.;

    // vec2 checkerboard = mod(floor(gl_FragCoord.xy / size), 2.);

    // float c = min(1., max(0.5, mod(checkerboard.x + checkerboard.y, 2.)));

    // noiseUv *= c;

    float n = cnoise(vUv * vec2(5., 50.) * uScalar);

    n = 0.99 + 0.01 * n;

    // 修改uv 添加噪音扰动
    // noiseUv = vUv * n;

    // 开始 sobel 采样
    vec2 texel = resolution;

    // kernel definition (in glsl matrices are filled in column-major order)
    // 原始算子
    // const mat3 Gx = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1); // x direction kernel
    // const mat3 Gy = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1); // y direction kernel

    // 增加算子
    int intensity = int(uIntensity);
    mat3 Gx = mat3(-1 * intensity, -2 * intensity, -1 * intensity, 0, 0, 0, 1 * intensity, 2 * intensity, 1 * intensity); // x direction kernel
    mat3 Gy = mat3(-1 * intensity, 0, 1 * intensity, -2 * intensity, 0, 2 * intensity, -1 * intensity, 0, 1 * intensity); // y direction kernel

    // fetch the 3x3 neighbourhood of a fragment

    // first column

    float tx0y0 = texture2D(samplerTexture, noiseUv + texel * vec2(-1, -1)).r;
    float tx0y1 = texture2D(samplerTexture, noiseUv + texel * vec2(-1, 0)).r;
    float tx0y2 = texture2D(samplerTexture, noiseUv + texel * vec2(-1, 1)).r;

    // second column

    float tx1y0 = texture2D(samplerTexture, noiseUv + texel * vec2(0, -1)).r;
    float tx1y1 = texture2D(samplerTexture, noiseUv + texel * vec2(0, 0)).r;
    float tx1y2 = texture2D(samplerTexture, noiseUv + texel * vec2(0, 1)).r;

    // third column

    float tx2y0 = texture2D(samplerTexture, noiseUv + texel * vec2(1, -1)).r;
    float tx2y1 = texture2D(samplerTexture, noiseUv + texel * vec2(1, 0)).r;
    float tx2y2 = texture2D(samplerTexture, noiseUv + texel * vec2(1, 1)).r;

    // gradient value in x direction

    float valueGx = Gx[0][0] * tx0y0 + Gx[1][0] * tx1y0 + Gx[2][0] * tx2y0 +
        Gx[0][1] * tx0y1 + Gx[1][1] * tx1y1 + Gx[2][1] * tx2y1 +
        Gx[0][2] * tx0y2 + Gx[1][2] * tx1y2 + Gx[2][2] * tx2y2;

    // gradient value in y direction

    float valueGy = Gy[0][0] * tx0y0 + Gy[1][0] * tx1y0 + Gy[2][0] * tx2y0 +
        Gy[0][1] * tx0y1 + Gy[1][1] * tx1y1 + Gy[2][1] * tx2y1 +
        Gy[0][2] * tx0y2 + Gy[1][2] * tx1y2 + Gy[2][2] * tx2y2;

    // magnitute of the total gradient

    float G = ((valueGx * valueGx) + (valueGy * valueGy));

    // gl_FragColor = vec4(diffuse * (1. - G), 1);

    vec3 diffuse = texture2D(tDiffuse, noiseUv).rgb;
    vec3 baseColor = texture2D(baseColorTexture, noiseUv).rgb;
    vec3 normalText = texture2D(normalTexture, noiseUv).rgb;
    float gate = step(0.0001, normalText.r + normalText.g + normalText.b);

    vec4 line = texture2D(lineTexture, noiseUv * 1.).rgba;
    vec4 horizontalLine = texture2D(horizontalLineTexture, noiseUv * 10.).rgba;
    vec4 verticalLine = texture2D(verticalLineTexture, noiseUv * 1.).rgba;

    // gl_FragColor = vec4(vec3(n), 1);
    // gl_FragColor = vec4(vec3(vUv,1.) * n, 1);
    // gl_FragColor = vec4(vec3(noiseUv, 1.), 1);
    // gl_FragColor = vec4(vec3(diffuse), 1);
    gl_FragColor = vec4(vec3(1.0 - G), 1);

    if(baseColor.r > 0.) {
        gl_FragColor.rgb *= baseColor;
    }
    // gl_FragColor.rgb = baseColor;
    
    float brightness = getBrightness(diffuse);

    float percent1 = 1.0 - smoothstep(0., brightnessStep.b1, brightness);
    gl_FragColor.rgb -= vec3(line.r * (2. )) * percent1;

    float percent2 = 1.0 -  smoothstep(0., brightnessStep.b3, brightness);
    gl_FragColor.rgb -= vec3(line.b * (2. )) * percent2;

    // gl_FragColor.rgb = baseColor;

    // if(gate > 0.) {
    //     if(brightness < brightnessStep.b1) {
    //         gl_FragColor.rgb -= vec3(line.r * 2.);
    //     }

    //     if(brightness < brightnessStep.b3) {
    //         gl_FragColor.rgb -= vec3(line.b * 2.);
    //     }
    // }

    // gl_FragColor.rgb -= vec3((line.r));
    // gl_FragColor.rgb -= vec3((line.g));
    // gl_FragColor.rgb -= vec3((line.b)) * (1. - step(0.2,diffuse.r));

    // gl_FragColor.rgb = vec3(brightness);
    // }
    // gl_FragColor.rgb = vec3(gate);
    // gl_FragColor.rgb = vec3(line.r);
    // gl_FragColor.rgb = vec3(line.g);
    // gl_FragColor.rgb = vec3(line.b);
    // gl_FragColor = vec4(vec3(texture2D(samplerTexture, noiseUv).rgb), 1);

}
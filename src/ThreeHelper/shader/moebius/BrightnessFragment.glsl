uniform sampler2D tDiffuse;
varying vec2 vUv;

// 获取颜色的亮度
// https://stackoverflow.com/questions/12043187/how-to-check-if-hex-color-is-too-black
// http://www.w3.org/TR/AERT#color-contrast
float getBrightness(vec3 color) {
    return (color.r * 299. + color.g * 587. + color.b * 114.) / (1000.);
}

void main() {

    vec3 diffuse = texture2D(tDiffuse, vUv).rgb;

    gl_FragColor = vec4(vec3(diffuse), 1);

    float brightness = getBrightness(diffuse);

    gl_FragColor.rgb = vec3(brightness);

}
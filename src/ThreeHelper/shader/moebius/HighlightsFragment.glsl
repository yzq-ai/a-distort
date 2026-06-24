uniform sampler2D tDiffuse;
uniform sampler2D depthTexture;
uniform sampler2D roughnessTexture;
uniform vec2 resolution;
uniform float uIntensity;
uniform float uScalar;

uniform float cameraNear;
uniform float cameraFar;
// uniform mat4 viewMatrix;
uniform mat4 cameraProjectionMatrix;
uniform mat4 cameraInverseProjectionMatrix;

varying vec2 vUv;

// 多点光 不知道为什么 热更新时 报错 遂使用单点光
// #if NUM_POINT_LIGHTS > 0
// struct PointLight {
//     vec3 position;
//     vec3 color;
//     float distance;
//     float decay;
//     bool visible;
// };

// uniform PointLight pointLights[NUM_POINT_LIGHTS];
// #endif
uniform vec3 tempPointLight;

#define texture2D texture

float perspectiveDepthToViewZ(const in float depth, const in float near, const in float far) {
    return (near * far) / ((far - near) * depth - far);
}

float viewZToOrthographicDepth(const in float viewZ, const in float near, const in float far) {
    return (viewZ + near) / (near - far);
}

float getDepth(const in vec2 screenPosition) {

    return texture2D(depthTexture, screenPosition).x;

}

float getLinearDepth(const in vec2 screenPosition) {

    float fragCoordZ = texture2D(depthTexture, screenPosition).x;
    float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
    return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);

}

float getViewZ(const in float depth) {

    return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);

}

vec3 getViewPosition(const in vec2 screenPosition, const in float depth, const in float viewZ) {

    float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];

    vec4 clipPosition = vec4((vec3(screenPosition, depth) - 0.5) * 2.0, 1.0);

    clipPosition *= clipW; // unprojection.

    return (cameraInverseProjectionMatrix * clipPosition).xyz;

}

// common.glsl.js
vec3 F_Schlick(const in vec3 f0, const in float f90, const in float dotVH) {

        // Original approximation by Christophe Schlick '94
        // float fresnel = pow( 1.0 - dotVH, 5.0 );

        // Optimized variant (presented by Epic at SIGGRAPH '13)
        // https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
    float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);

    return f0 * (1.0 - fresnel) + (f90 * fresnel);

}

float F_Schlick(const in float f0, const in float f90, const in float dotVH) {

        // Original approximation by Christophe Schlick '94
        // float fresnel = pow( 1.0 - dotVH, 5.0 );

        // Optimized variant (presented by Epic at SIGGRAPH '13)
        // https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
    float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);

    return f0 * (1.0 - fresnel) + (f90 * fresnel);

}

// bsdfs.glsl.js
float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {

        // geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
    return 0.25;

}

float D_BlinnPhong(const in float shininess, const in float dotNH) {

    return RECIPROCAL_PI * (shininess * 0.5 + 1.0) * pow(dotNH, shininess);

}

vec3 BRDF_BlinnPhong(const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess) {

    vec3 halfDir = normalize(lightDir + viewDir);

    float dotNH = clamp(dot(normal, halfDir), 0., 1.);
    float dotVH = clamp(dot(viewDir, halfDir), 0., 1.);

    vec3 F = F_Schlick(specularColor, 1.0, dotVH);

    float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );

    float D = D_BlinnPhong(shininess, dotNH);

    return F * (G * D);

}

void main() {

    gl_FragColor = vec4(vec3(0.), 1.);

    // #if NUM_POINT_LIGHTS > 0

    vec3 normalText = texture2D(tDiffuse, vUv).rgb;
    float roughness = texture2D(roughnessTexture, vUv).r;

    float depth = getDepth(vUv);
    float viewZ = getViewZ(depth);
    vec3 viewPosition = -getViewPosition(vUv, depth, viewZ);

    vec3 normal = (normalText - 0.5) / 0.5;

    // vec3 fdx = dFdx(viewPosition);
    // vec3 fdy = dFdy(viewPosition);
    // vec3 normal = normalize(cross(fdx, fdy));

    vec3 geometryPosition = -viewPosition;
    vec3 geometryNormal = normal;
    vec3 geometryViewDir = normalize(viewPosition);

    // 多点光 不知道为什么 热更新时 报错 遂使用单点光
    // PointLight pointLight;

    // vec3 directSpecular = vec3(0.);

    // for(int i = 0; i < NUM_POINT_LIGHTS; i++) {
    //     pointLight = pointLights[ i ];

    //     vec3 lVector = pointLight.position - geometryPosition;
    //     vec3 lightDirection = normalize(lVector);

    //     directSpecular += BRDF_BlinnPhong(lightDirection, geometryViewDir, geometryNormal, vec3(1), 30.);
    // }
    // gl_FragColor = vec4(vec3(directSpecular), 1.);

    // #endif

    vec3 lVector = tempPointLight - geometryPosition;
    vec3 lightDirection = normalize(lVector);

    // float shininess = 60. * (roughness.r > 0. ? roughness.r : -1.);
    float shininess = 30. * (1.0 - roughness);

    vec3 directSpecular = BRDF_BlinnPhong(lightDirection, geometryViewDir, geometryNormal, vec3(1), shininess);

    if(directSpecular.r < 1.) {
        directSpecular = vec3(0.);
    }

    gl_FragColor = vec4(vec3(max(vec3(0.),directSpecular) * 0.2), 1.);

    gl_FragColor.rgb += normalText;
}
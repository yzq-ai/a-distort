/*
 * @Author: hongbin
 * @Date: 2024-11-07 08:47:38
 * @LastEditors: hongbin
 * @LastEditTime: 2024-11-13 11:23:57
 * @Description: 树脂玻璃材质
 */
import * as THREE from "three";

export class ResinGlassMaterial extends THREE.ShaderMaterial {
    onBeforeRender(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
        const viewMatrix = camera.matrixWorldInverse;

        this.uniforms.cameraPos.value.setFromMatrixPosition(camera.matrixWorld);
        this.uniforms.cameraPos.value.applyMatrix4(viewMatrix);
    }

    constructor(
        public params: {
            normalMap: THREE.Texture;
            color: THREE.Color;
            dinColor: THREE.Color;
            side:THREE.Side,
            opacity:number
        }
    ) {
        params.normalMap.wrapS = THREE.RepeatWrapping;
        params.normalMap.wrapT = THREE.RepeatWrapping;

        super({
            side:params.side || THREE.FrontSide,
            transparent: true,
            uniforms: {
                cameraPos: { value: new THREE.Vector3() },
                normalMap: { value: params.normalMap },
                color: { value: params.color },
                opacity: { value: params.opacity == undefined ? 1 : params.opacity },
                dinColor: { value: params.dinColor },
                iScale: { value: 1 },
                iRotate: { value: 0 },
                xyRepeat: { value: new THREE.Vector2(0.1, 0.1) },
            },
            defines: {
                RECIPROCAL_PI: 1 / Math.PI,
            },
            vertexShader: /* glsl */ `
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec2 vUv;
                varying vec3 tripPosition;
                varying vec3 tripNormal;
                uniform float iScale;
                uniform float iRotate;
                uniform vec2 xyRepeat;

                #include <skinning_pars_vertex>

                ${TriCode}

                void main() {
                    vNormal = normalMatrix * normal;
                    // vNormal = vec3(0.);
                    vec3 transformed = position;
                    vec3 objectNormal = normal;
                    vec3 objectTangent;

                	#include <skinbase_vertex>
                    #include <skinning_vertex>
                    #include <skinnormal_vertex>

                    vec4 modelViewPosition = modelViewMatrix * vec4(transformed, 1.0);
                    gl_Position = projectionMatrix * modelViewPosition;
 
                    vViewPosition = - modelViewPosition.xyz;
                    vUv = uv;

                    vec4 tripPosition4 = modelMatrix * vec4(transformed,1.) ;
                    tripPosition = tripPosition4.xyz;
                    
                    // vec3 world_space_normal = vec3(modelMatrix * vec4(objectNormal, 0.0));
                    vec3 world_space_normal = vec3(modelMatrix * vec4(objectNormal, 0.0));
                    tripNormal = world_space_normal;
                    // tripNormal = normalMatrix * objectNormal;
                    vNormal = normalMatrix * objectNormal;
                }`,
            fragmentShader: /* glsl */ `
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                varying vec2 vUv;
                varying vec3 tripPosition;
                varying vec3 tripNormal;
                uniform float iScale;
                uniform vec2 xyRepeat;
                uniform float iRotate;

                uniform vec3 cameraPos;
                uniform vec3 color;
                uniform vec3 dinColor;
                uniform mat3 normalMatrix;
                uniform sampler2D normalMap;
                uniform float opacity;
                ${bsdfs_glsl}
                ${TriCode}

                void main() {
                    
                    // vec3 diffMap = vec3( triplanarMapping( map , tripNormal, tripPosition ) );
                    vec3 prevNormal =  vec3( triplanarMapping( normalMap , tripNormal, tripPosition ) );

                    vec3 normal = normalMatrix * prevNormal;
                    // vec3 diffMap = texture2D(map, vUv).rgb;
                    // vec3 normal = normalMatrix * normalize( (texture2D(normalMap, vUv).rgb * 2. - 1.));
                    // normal =  (texture2D(normalMap, vUv).rgb );

                    vec3 geometryPosition = - vViewPosition;
                    vec3 geometryNormal = normalize(normal);
                    // vec3 geometryNormal = normalize(vNormal);
                    vec3 geometryViewDir = normalize( vViewPosition );
                    
                    vec3 directSpecular = vec3(0.);
                    vec3 diffuse = vec3(0.);

                    vec3 lVector = cameraPos - geometryPosition;
                    
                    vec3 lightDirection = normalize( lVector );

                    // 漫反射
                    float diff = max(dot(normal, lightDirection), 0.0);

                    float fd = 1.0 - pow(max(dot(normalize(cameraPos - geometryPosition),geometryNormal), 0.0),0.5);

                    directSpecular += BRDF_BlinnPhong( lightDirection, geometryViewDir, geometryNormal, vec3(1), 30.);

                    float lightDistance = length( lVector );

                    float attenuation = getDistanceAttenuation(lightDistance,0.,0.5);

                    // gl_FragColor.rgb = (directSpecular * attenuation + diffMap) * color + (dinColor * directSpecular * attenuation);
                    // gl_FragColor.rgb = vec3(diffMap);
                    // gl_FragColor.rgb = color;
                    gl_FragColor.rgb = vec3(prevNormal * vec3(0,1,0));
                    gl_FragColor.rgb += vec3(fd) * dinColor * 1.;
                    // gl_FragColor.rgb = vec3(normal);
                    // gl_FragColor.rgb = vec3(directSpecular);
                    // gl_FragColor.rgb = (directSpecular * attenuation + diffMap) * color;
                    // gl_FragColor.rgb += vec3(fd * dinColor);
                    // gl_FragColor.rgb = vec3(1);
                    // gl_FragColor.rgb = vec3(directSpecular);
                    // gl_FragColor.rgb += pow(dinColor * directSpecular * attenuation,2.);
                    // gl_FragColor.rgb = pow( directSpecular.r * attenuation, 5. ) * dinColor * 150.;
                    // gl_FragColor.rgb += pow( directSpecular.r * attenuation, 2. ) * dinColor * 8.;
                    
				    // gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

                    gl_FragColor.a = opacity;

                    // float brightness = getBrightness(normal); 

                    // if(brightness > 0.6){
                    //     gl_FragColor.rgb = vec3(1.);
                    // } else {
                    //     gl_FragColor.rgb = vec3(0.);
                    // }
                }`,
        });
    }
}

const bsdfs_glsl = /* glsl */ `

    float getBrightness(vec3 color) {
        return (color.r * 299. + color.g * 587. + color.b * 114.) / (1000.);
    }

    float pow2( const in float x ) { return x*x; }
    vec3 pow2( const in vec3 x ) { return x*x; }
    float pow4( const in float x ) { float x2 = x*x; return x2*x2; }

    // 距离衰减
    float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
            
        float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );

        if ( cutoffDistance > 0.0 ) {

            distanceFalloff *= pow2( clamp( 1.0 - pow4( lightDistance / cutoffDistance ) ,0. ,1.) );

        }

        return distanceFalloff;

    }

    // common.glsl.js
    vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {

        // Original approximation by Christophe Schlick '94
        // float fresnel = pow( 1.0 - dotVH, 5.0 );

        // Optimized variant (presented by Epic at SIGGRAPH '13)
        // https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
        float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

        return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

    }

    float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {

        // Original approximation by Christophe Schlick '94
        // float fresnel = pow( 1.0 - dotVH, 5.0 );

        // Optimized variant (presented by Epic at SIGGRAPH '13)
        // https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
        float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

        return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

    }

    // bsdfs.glsl.js

    float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {

        // geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
        return 0.25;

    }

    float D_BlinnPhong( const in float shininess, const in float dotNH ) {

        return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );

    }

    vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {

        vec3 halfDir = normalize( lightDir + viewDir );

        float dotNH = clamp( dot( normal, halfDir ) ,0.,1.);
        float dotVH = clamp( dot( viewDir, halfDir ) ,0.,1.);

        vec3 F = F_Schlick( specularColor, 1.0, dotVH );

        float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );

        float D = D_BlinnPhong( shininess, dotNH );

        return F * ( G * D );

    }
`;

const TriCode = `

vec3 blendNormal(vec3 normal){
    vec3 blending = abs( normal );
    blending = normalize(max(blending, 0.00001)); // Force weights to sum to 1.0 
    float b = (blending.x + blending.y + blending.z);
    blending /= vec3(b, b, b);
    return blending;
}

vec3 triplanarMapping (sampler2D tex, vec3 normal, vec3 position) {
    vec3 normalBlend = blendNormal(normal);
    vec3 xColor = texture(tex, position.zy * iScale * xyRepeat).rgb;
    vec3 yColor = texture(tex, position.zx* iScale * xyRepeat).rgb;
    vec3 zColor = texture(tex, position.xy* iScale * xyRepeat).rgb;
    return (xColor * normalBlend.x + yColor * normalBlend.y + zColor * normalBlend.z);
    }
`;

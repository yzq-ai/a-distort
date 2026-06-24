/*
 * @Author: hongbin
 * @Date: 2024-09-27 19:07:25
 * @LastEditors: hongbin
 * @LastEditTime: 2024-10-26 14:26:21
 * @Description: Specular
 * WebGlRenderer  -> constrictor -> getProgram ->
 * uniforms.pointLights.value = lights.state.point;
 */
import * as THREE from "three";

interface PointLightUniforms {
    color: THREE.PointLight["color"];
    decay: THREE.PointLight["decay"];
    position: THREE.PointLight["position"];
    distance: THREE.PointLight["distance"];
    visible: THREE.PointLight["visible"];
}

const bsdfs_glsl = /* glsl */ `

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

/** Blinn-Phong模型 直接反射高光材质(暂止支持点光源) */
export class SpecularShaderMaterial extends THREE.ShaderMaterial {
    PointLights: PointLightUniforms[] = [];
    original: ConstructorParameters<typeof THREE.ShaderMaterial>[0];
    color = new THREE.Color(0xffffff);

    onBeforeRender(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
        const PointLights: PointLightUniforms[] = [];

        const viewMatrix = camera.matrixWorldInverse;

        scene.traverse((obj) => {
            if (obj.type == "PointLight") {
                const light = obj as THREE.PointLight;
                const uniforms = {
                    color: light.color.clone(),
                    decay: light.decay,
                    position: new THREE.Vector3(),
                    distance: light.distance,
                    /** 采集visible信息 不用更新着色器 （新增灯光则需要重新构建着色器） */
                    visible: light.visible,
                };
                // uniforms.color.multiplyScalar(light.intensity);
                uniforms.position.setFromMatrixPosition(light.matrixWorld);
                uniforms.position.applyMatrix4(viewMatrix);
                PointLights.push(uniforms);
            }
        });

        // this.fragmentShader = this.replaceLightNums(this.original!.fragmentShader!, {
        //     numPointLights: PointLights.length,
        // });

        this.uniforms.pointLights.value = PointLights;
    }

    constructor(
        params?: ConstructorParameters<typeof THREE.ShaderMaterial>[0] & {
            // pointLightPosition: THREE.Vector3;
            // pointLightDistance: number;
            // pointLightDecay: number;
            scene: THREE.Scene;
            camera: THREE.PerspectiveCamera;
            roughness: number;
        }
    ) {
        const original = {
            uniforms: {
                pointLights: {
                    value: [] as PointLightUniforms[],
                },
                roughness: {
                    value: params?.roughness,
                },
            },
            defines: {
                RECIPROCAL_PI: 1 / Math.PI,
                // 平直着色 关闭则 平滑着色
                FLAT_SHADED: false,
            },
            vertexShader: /* glsl */ `
                varying vec3 vNormal;
                
                varying vec3 vViewPosition;

                void main() {

                    vNormal = normalMatrix * normal;
                    vNormal = normalize( vNormal );

                    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * modelViewPosition;

                    vec3 transformed = vec3( position );

                    vec4 mvPosition = vec4( transformed, 1.0 );
                    
                    mvPosition = modelViewMatrix * mvPosition;

	                vViewPosition = - mvPosition.xyz;

                }`,
            fragmentShader: /* glsl */ `
                varying vec3 vNormal;               
                varying vec3 vViewPosition;

                uniform float roughness;

                
                #if NUM_POINT_LIGHTS > 0
                    struct PointLight {
                        vec3 position;
                        vec3 color;
                        float distance;
                        float decay;
                        bool visible;
                    };

                    uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
                #endif

                ${bsdfs_glsl}

                void main() {
                    gl_FragColor = vec4(vec3( 0. ) , 1. );

                    #if NUM_POINT_LIGHTS > 0
                        #ifdef FLAT_SHADED

                            vec3 fdx = dFdx( vViewPosition );
                            vec3 fdy = dFdy( vViewPosition );
                            vec3 normal = normalize( cross( fdx, fdy ) );

                        #else

                            vec3 normal =  vNormal ;
                            normal = normalize( vNormal );

                        #endif

                        vec3 geometryPosition = - vViewPosition;
                        vec3 geometryNormal = normal;
                        vec3 geometryViewDir = normalize( vViewPosition );

                        PointLight pointLight;

                        vec3 directSpecular = vec3(0.);

                        for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
                            pointLight = pointLights[ i ];

                            // 取自 getPointLightInfo
                            vec3 lVector = pointLight.position - geometryPosition;
                    
                            vec3 lightDirection = normalize( lVector );

                            float shininess = 30. * (1.0 - roughness);

                            directSpecular += pointLight.visible ? BRDF_BlinnPhong( lightDirection, geometryViewDir, geometryNormal, vec3(1), shininess) : vec3(0.);
                        }

                        if(directSpecular.r < 1.) {
                            directSpecular = vec3(0.);
                        }
                        
                        gl_FragColor = vec4(vec3( (normal * 0.5 + 0.5) + max(0.,directSpecular.r * 0.2) ) , 1. );
                        // gl_FragColor = vec4(vec3(  directSpecular ) , 1. );
                    #endif
                }
            `,
        };

        const PointLights: PointLightUniforms[] = [];

        const viewMatrix = params!.camera.matrixWorldInverse;

        params!.scene.traverse((obj) => {
            if (obj.type == "PointLight") {
                const light = obj as THREE.PointLight;
                const uniforms = {
                    color: light.color.clone(),
                    decay: light.decay,
                    position: new THREE.Vector3(),
                    distance: light.distance,
                    /** 采集visible信息 不用更新着色器 （新增灯光则需要重新构建着色器） */
                    visible: light.visible,
                };
                // uniforms.color.multiplyScalar(light.intensity);
                uniforms.position.setFromMatrixPosition(light.matrixWorld);
                uniforms.position.applyMatrix4(viewMatrix);
                PointLights.push(uniforms);
            }
        });

        const replaceLightNums = (string: string, parameters: { numPointLights: number }) => {
            return string.replace(/NUM_POINT_LIGHTS/g, "" + parameters.numPointLights);
        };

        original.uniforms.pointLights = { value: PointLights };

        original.fragmentShader = replaceLightNums(original!.fragmentShader!, {
            numPointLights: PointLights.length,
        });

        super(original);
        this.original = original;
    }

    replaceLightNums(string: string, parameters: { numPointLights: number }) {
        return string.replace(/NUM_POINT_LIGHTS/g, "" + parameters.numPointLights);
    }
}

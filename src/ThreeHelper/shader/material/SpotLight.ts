/*
 * @Author: hongbin
 * @Date: 2024-10-25 18:30:35
 * @LastEditors: hongbin
 * @LastEditTime: 2024-10-29 14:36:12
 * @Description:
 */
import * as THREE from "three";

interface SpotLightUniforms {
    color: THREE.SpotLight["color"];
    intensity: THREE.SpotLight["intensity"];
    distance: THREE.SpotLight["distance"];

    decay: THREE.SpotLight["decay"];
    visible: THREE.SpotLight["visible"];
    position: THREE.SpotLight["position"];

    coneCos: number;
    penumbraCos: number;
}

export class SpotLightMaterial extends THREE.ShaderMaterial {
    Lights: SpotLightUniforms[] = [];
    original: ConstructorParameters<typeof THREE.ShaderMaterial>[0];
    color = new THREE.Color(0xffffff);

    onBeforeRender(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
        const Lights: SpotLightUniforms[] = [];

        const viewMatrix = camera.matrixWorldInverse;
        const vector3 = new THREE.Vector3();

        scene.traverse((obj) => {
            if (obj.type == "SpotLight") {
                const light = obj as THREE.SpotLight;
                const uniforms = {
                    position: new THREE.Vector3(),
                    direction: new THREE.Vector3(),
                    color: light.color.clone().multiplyScalar(light.intensity),
                    intensity: light.intensity,
                    distance: light.distance,
                    decay: light.decay,
                    visible: light.visible,

                    coneCos: Math.cos(light.angle),
                    penumbraCos: Math.cos(light.angle * (1 - light.penumbra)),
                };

                uniforms.position.setFromMatrixPosition(light.matrixWorld);
                uniforms.position.applyMatrix4(viewMatrix);

                uniforms.direction.setFromMatrixPosition(light.matrixWorld);
                vector3.setFromMatrixPosition(light.target.matrixWorld);
                uniforms.direction.sub(vector3);
                uniforms.direction.transformDirection(viewMatrix);

                // console.log(uniforms.position)
                // console.log(uniforms.direction)

                Lights.push(uniforms);
            }
        });

        // this.fragmentShader = this.replaceLightNums(this.original!.fragmentShader!, {
        //     numPointLights: PointLights.length,
        // });

        this.uniforms.spotLights.value = Lights;
    }

    constructor(
        params?: ConstructorParameters<typeof THREE.ShaderMaterial>[0] & {
            scene: THREE.Scene;
            camera: THREE.PerspectiveCamera;
            roughness: number;
            AmbientLight?: THREE.Color;
        }
    ) {
        const original = {
            uniforms: {
                spotLights: {
                    value: [] as SpotLightUniforms[],
                },
                roughness: {
                    value: params?.roughness,
                },
                AmbientLight: { value: params?.AmbientLight ?? new THREE.Color(0x000000) },
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
                
                uniform vec3 AmbientLight;
                uniform float roughness;

                
                #if NUM_SPOT_LIGHTS > 0
                    struct SpotLight {
                        vec3 position;
                        vec3 direction;
                        vec3 color;
                        float distance;
                        float decay;
                        bool visible;
                        float angle;
                        float penumbra;
                        float coneCos;
                        float penumbraCos;
                    };

                    uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
                #endif

                #include <common>

                float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

                    return smoothstep( coneCosine, penumbraCosine, angleCosine );

                }


                float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

                    // based upon Frostbite 3 Moving to Physically-based Rendering
                    // page 32, equation 26: E[window1]
                    // https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
                    float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );

                    if ( cutoffDistance > 0.0 ) {

                        distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

                    }

                    return distanceFalloff;

                }

                void main() {
                    gl_FragColor = vec4(vec3( 1,0,0 ) , 1. );

                    #if NUM_SPOT_LIGHTS > 0
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

                        SpotLight spotLight;

                        vec3 directSpecular = vec3(0.);
                        vec3 diffuse = vec3(0.);

                        for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
                            spotLight = spotLights[ i ];

                            vec3 lVector = spotLight.position - geometryPosition;
                    
                            vec3 lightDirection = normalize( lVector );

                            // 漫反射
                            float diff = max(dot(normal, lightDirection), 0.0);
                            // * spotLight.color

                            float angleCos = dot( lightDirection, spotLight.direction);
                            
                            float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
                            
                            // if(angleCos > spotLight.coneCos){
                            //     diffuse = vec3(1.);
                            // }else {
                            //     diffuse = vec3(0.);
                            // }

                            if(spotAttenuation > 0.0){
                                float lightDistance = length( lVector );

                                float attenuation = getDistanceAttenuation(lightDistance, spotLight.distance, spotLight.decay);
                                
                                diffuse += diff * spotLight.color * spotAttenuation * attenuation;
                            }

                        }

                        // gl_FragColor = vec4( directSpecular , 1. );
                        gl_FragColor = vec4( diffuse + AmbientLight , 1. );

                    #endif
                }
            `,
        };

        const SpotLights: SpotLightUniforms[] = [];

        const viewMatrix = params!.camera.matrixWorldInverse;
        const vector3 = new THREE.Vector3();

        params!.scene.traverse((obj) => {
            if (obj.type == "SpotLight") {
                const light = obj as THREE.SpotLight;
                const uniforms = {
                    position: new THREE.Vector3(),
                    direction: new THREE.Vector3(),
                    color: light.color.clone().multiplyScalar(light.intensity),
                    intensity: light.intensity,
                    distance: light.distance,
                    decay: light.decay,
                    visible: light.visible,

                    coneCos: Math.cos(light.angle),
                    penumbraCos: Math.cos(light.angle * (1 - light.penumbra)),
                };

                console.log(uniforms.coneCos);
                console.log(uniforms.penumbraCos);

                uniforms.position.setFromMatrixPosition(light.matrixWorld);
                uniforms.position.applyMatrix4(viewMatrix);

                uniforms.direction.setFromMatrixPosition(light.matrixWorld);
                vector3.setFromMatrixPosition(light.target.matrixWorld);
                uniforms.direction.sub(vector3);
                uniforms.direction.transformDirection(viewMatrix);

                SpotLights.push(uniforms);
            }
        });

        const replaceLightNums = (string: string, parameters: { numSpotLights: number }) => {
            return string.replace(/NUM_SPOT_LIGHTS/g, "" + parameters.numSpotLights);
        };

        original.uniforms.spotLights = { value: SpotLights };

        original.fragmentShader = replaceLightNums(original!.fragmentShader!, {
            numSpotLights: SpotLights.length,
        });

        super(original);
        this.original = original;
    }
}

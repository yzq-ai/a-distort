/*
 * @Author: hongbin
 * @Date: 2024-09-27 10:22:25
 * @LastEditors: hongbin
 * @LastEditTime: 2024-09-27 17:01:56
 * @Description:
 */
import * as THREE from "three";

export class NormalShaderMaterial extends THREE.ShaderMaterial {
    constructor(params?: ConstructorParameters<typeof THREE.ShaderMaterial>[0]) {
        super({
            uniforms: {},
            vertexShader: /* glsl */ `
                varying vec3 vNormal;

                void main() {

                    vNormal = normalMatrix * normal;

                    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * modelViewPosition;
                }`,
            fragmentShader: /* glsl */ `
                varying vec3 vNormal;               

                void main() {
                    
                    gl_FragColor = vec4( normalize( vNormal ) * 0.5 + 0.5, 1. );
                }`,
        });
    }
}

/*
 * @Author: hongbin
 * @Date: 2024-12-07 14:18:01
 * @LastEditors: hongbin
 * @LastEditTime: 2024-12-11 12:51:03
 * @Description:
 */
import * as THREE from "three";

interface IParams {
    uniforms: { [uniform: string]: THREE.IUniform<any> };
}

export class AnimatingTrianglesShaderMaterial extends THREE.ShaderMaterial {
    constructor(params: IParams) {
        super();

        // this.extensions = {
        // derivatives: "#extension GL_OES_standard_derivatives : enable",
        // };

        this.uniforms = {
            ...params.uniforms,
        };

        this.defines = {};

        this.side = 2;

        // this.wireframe = true;

        this.vertexShader = /* glsl */ `
            varying vec2 vUv;
            varying vec3 vNormal;
            
            attribute vec3 aCenter;
            attribute float aRandom;
            
            uniform float iTime;
            uniform float iProgress;

            #include <common>

            mat4 rotation3d(vec3 axis, float angle) {
                axis = normalize(axis);
                float s = sin(angle);
                float c = cos(angle);
                float oc = 1.0 - c;
              
                return mat4(
                  oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                  oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                  oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                  0.0,                                0.0,                                0.0,                                1.0
                );
              }

            void main() {
                vUv = uv;
                vNormal = normalize( normal ) * 0.5 + 0.5;
                
                // TODO: 动态物体高度
                float prog = (position.y + 1.) / 2.;
                // float prog = 1.;

                float locprog = clamp( ( iProgress - 0.8 * prog ) / 0.2, 0. , 1. );

                vec3 transform = position - aCenter;

                transform += 3. * aRandom * normal * locprog;
                // transform += 3. * aRandom * normal;

                transform *= (1.0 - locprog);
                // transform *= iProgress;
                // vec3 transform = vec3(position - aCenter) * iProgress;
                // vec3 transform = vec3(position);

                transform += aCenter;
                
                mat4 rotation = rotation3d(vec3(0.,1.,0.),aRandom * (locprog) * PI * 3.);
                // mat4 rotation = rotation3d(aCenter, iProgress * PI * 2.);
                
                
                transform = (rotation * vec4(transform,1.)).xyz;
                
                vec4 modelViewPosition = modelViewMatrix * vec4(transform, 1.0);

                gl_Position = projectionMatrix * modelViewPosition;
            }
        `;

        this.fragmentShader = /* glsl */ `
            varying vec3 vNormal;

            void main() {
            
                vec3 color = vec3(vNormal);
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }
}

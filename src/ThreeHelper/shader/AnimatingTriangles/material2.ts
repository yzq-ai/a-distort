/*
 * @Author: hongbin
 * @Date: 2024-12-11 13:06:29
 * @LastEditors: hongbin
 * @LastEditTime: 2024-12-11 21:18:13
 * @Description:
 */
import * as THREE from "three";

interface IParams {
    uniforms: { [uniform: string]: THREE.IUniform<any> };
}

export class AnimatingTrianglesShaderMaterial2 extends THREE.ShaderMaterial {
    constructor(params: IParams) {
        super();

        this.uniforms = {
            ...params.uniforms,
        };

        this.defines = {};

        this.side = 2;

        // this.wireframe = true;

        this.vertexShader = /* glsl */ `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vViewPosition;
            
            attribute vec3 aCenter;
            attribute vec3 toPosition;
            attribute vec3 toNormal;
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
                
                // float progress = iProgress;
                float progress = abs(sin(iTime));
                float sinProgress = sin(progress * PI);
                
                vec3 pos = mix(position,toPosition,progress);
                vec3 nor = mix(normal,toNormal,progress);

                // vNormal = (normalize( nor ) - 0.5) * 2.;
                // vNormal = (normalize( nor ) * 0.5) + 0.5;
                vNormal = normalMatrix * normalize( nor );

                // vec3 nor = toNormal;

                // float prog = uv.y;
                float prog = ((pos.y + 1.) / 2.) * 1.1;
             
                float locprog = clamp( ( sinProgress - 0.9 * prog ) / 0.2, 0. , 1. );

                vec3 transform = pos - aCenter;

                transform += 3. * aRandom * nor * locprog;
                // transform += 3. * aRandom * normal;

                transform *= (1.0 - locprog);
                // transform *= progress;
                // vec3 transform = vec3(position - aCenter) * progress;
                // vec3 transform = vec3(position);

                transform += aCenter;
                
                mat4 rotation = rotation3d(vec3(0.,1.,0.),aRandom * (locprog) * PI * 3.);
                // mat4 rotation = rotation3d(aCenter, progress * PI * 2.);

                transform = (rotation * vec4(transform,1.)).xyz;
                
                vec4 modelViewPosition = modelViewMatrix * vec4(transform, 1.0);

                gl_Position = projectionMatrix * modelViewPosition;

                vViewPosition =  - modelViewPosition.xyz;
            }
        `;

        this.fragmentShader = /* glsl */ `
            varying vec3 vNormal;
            varying vec2 vUv;
            varying vec3 vViewPosition;
            uniform sampler2D matcap;
            uniform sampler2D matcap2;
            uniform float iTime;

            void main() {

                // vec3 fdx = dFdx( vViewPosition );
                // vec3 fdy = dFdy( vViewPosition );
                // vec3 normal = normalize( cross( fdx, fdy ) );

                vec3 viewDir = normalize( vViewPosition );
            	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
                vec3 y = cross( viewDir, x );
                vec2 uv = vec2( dot( x, vNormal ), dot( y, vNormal ) ) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks

                float progress = abs(sin(iTime));

                vec3 matcapColor = texture2D(matcap,uv).rgb;
                vec3 matcap2Color = texture2D(matcap2,uv).rgb;


                vec3 color = vec3(matcapColor);
                color = mix(color,matcap2Color,progress);
                // vec3 color = vec3( mix( 0.2, 0.8, uv.y ) );

                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }
}

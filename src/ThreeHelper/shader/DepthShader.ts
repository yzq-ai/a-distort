/*
 * @Author: hongbin
 * @Date: 2024-09-09 12:04:00
 * @LastEditors: hongbin
 * @LastEditTime: 2024-09-10 16:00:25
 * @Description: 深度 from SSAODepthShader
 */
export const DepthShader = {
    name: "DepthShader",

    defines: {
        PERSPECTIVE_CAMERA: 1,
    },

    uniforms: {
        tDepth: { value: null },
        cameraNear: { value: null },
        cameraFar: { value: null },
    },

    vertexShader: `
        varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

    fragmentShader: `
        uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;

		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		void main() {

			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`,
};

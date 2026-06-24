/*
 * @Author: hongbin
 * @Date: 2024-09-09 17:33:56
 * @LastEditors: hongbin
 * @LastEditTime: 2024-09-17 17:35:49
 * @Description:
 */
export const MixShader = {
    defines: {},

    uniforms: {
        aTexture: { value: null },
        bTexture: { value: null },
    },

    vertexShader: `
        varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

    fragmentShader: `
        uniform sampler2D aTexture;
        uniform sampler2D bTexture;

		varying vec2 vUv;

		void main() {

			vec4 a = texture2D( aTexture, vUv );
			vec4 b = texture2D( bTexture, vUv );

			// gl_FragColor =  b;
			gl_FragColor = mix( a, b, 0.5);
            // gl_FragColor =  b * (a);
		}`,
};

/*
 * @Author: hongbin
 * @Date: 2023-08-29 12:17:09
 * @LastEditors: hongbin
 * @LastEditTime: 2023-09-11 12:30:41
 * @Description:辉光装饰器
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass";
import { ThreeHelper } from "..";

export interface IInitEffect {
    (
        renderer: THREE.WebGLRenderer,
        scene: THREE.Scene,
        camera: THREE.Camera
    ): void;
}

const defaultParams = {
    /** 关闭后期处理 */
    close: false,
    /** 使用fxaa抗锯齿 */
    fxaa: false,
    /** 使用smaa抗锯齿 */
    smaa: false,
    /** bloom参数 */
    bloom: { threshold: 0, strength: 1, radius: 0.5, exposure: 1 },
};

export function UnrealBloomEffect(params?: Partial<typeof defaultParams>) {
    return _UnrealBloomEffect(params);
}

function _UnrealBloomEffect(_params?: Partial<typeof defaultParams>) {
    return function <T extends { new (...args: any[]): {} }>(constructor: T) {
        if (_params?.close) {
            constructor.prototype.select = () => {};
            return;
        }
        return class UnrealBloomEffect extends constructor {
            static BLOOM_SCENE = 1;
            helper!: ThreeHelper;
            bloomLayer = new THREE.Layers();
            params = {
                threshold: 0,
                strength: 1,
                radius: 0.5,
                exposure: 1,
                ...(_params?.bloom ?? {}),
            };
            darkMaterial = new THREE.MeshBasicMaterial({
                color: "black",
            });
            materials: Record<string, THREE.Material | THREE.Material[]> = {};
            resize!: () => void;

            constructor(...rest: any[]) {
                super(...rest);
                this.bloomLayer.set(UnrealBloomEffect.BLOOM_SCENE);
                this.initEffect(
                    this.helper.renderer,
                    this.helper.scene,
                    this.helper.camera
                );
            }

            select(object: Object3D) {
                object.layers.toggle(UnrealBloomEffect.BLOOM_SCENE);
            }

            initEffect(
                renderer: THREE.WebGLRenderer,
                scene: THREE.Scene,
                camera: THREE.PerspectiveCamera
            ) {
                const renderScene = new RenderPass(scene, camera);

                const bloomPass = new UnrealBloomPass(
                    new THREE.Vector2(
                        renderer.domElement.offsetWidth,
                        renderer.domElement.offsetHeight
                    ),
                    this.params.strength,
                    this.params.radius,
                    this.params.threshold
                );
                const bloomComposer = new EffectComposer(renderer);
                bloomComposer.renderToScreen = false;
                bloomComposer.addPass(renderScene);
                bloomComposer.addPass(bloomPass);

                const mixPass = new ShaderPass(
                    new THREE.ShaderMaterial({
                        uniforms: {
                            baseTexture: { value: null },
                            bloomTexture: {
                                value: bloomComposer.renderTarget2.texture,
                            },
                        },
                        vertexShader: `varying vec2 vUv;

                        void main() {
            
                            vUv = uv;
            
                            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            
                        }`,
                        fragmentShader: `uniform sampler2D baseTexture;
                        uniform sampler2D bloomTexture;
            
                        varying vec2 vUv;
            
                        void main() {
            
                            gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
            
                        }`,
                        defines: {},
                    }),
                    "baseTexture"
                );

                const outputPass = new OutputPass();

                const finalComposer = new EffectComposer(renderer);
                finalComposer.addPass(renderScene);
                finalComposer.addPass(mixPass);

                const { width, height } = renderer.getDrawingBufferSize(
                    new THREE.Vector2()
                );
                let fxaaPass: ShaderPass, smaa: SMAAPass;
                if (_params?.fxaa) {
                    fxaaPass = new ShaderPass(FXAAShader);
                    fxaaPass.uniforms.resolution.value.set(
                        1 / width,
                        1 / height
                    );

                    finalComposer.addPass(fxaaPass);
                } else if (_params?.smaa) {
                    smaa = new SMAAPass(width, height);

                    finalComposer.addPass(smaa);
                }

                finalComposer.addPass(outputPass);

                this.helper.render = () => {
                    scene.traverse(this.darkenNonBloomed);
                    bloomComposer.render();
                    scene.traverse(this.restoreMaterial);
                    finalComposer.render();
                };

                this.resize = () => {
                    bloomPass.resolution.set(
                        renderer.domElement.offsetWidth,
                        renderer.domElement.offsetHeight
                    );
                    const { width, height } = renderer.getDrawingBufferSize(
                        new THREE.Vector2()
                    );

                    if (_params?.fxaa) {
                        fxaaPass.uniforms.resolution.value.set(
                            1 / width,
                            1 / height
                        );
                    } else if (_params?.smaa) {
                        smaa.setSize(width, height);
                    }
                };
                this.resizeListen();
            }

            protected selfResize = () => this.resize.call(this);

            resizeListen() {
                window.addEventListener("resize", this.selfResize);
            }

            darkenNonBloomed = (obj: any) => {
                if (obj.isMesh && this.bloomLayer.test(obj.layers) === false) {
                    this.materials[obj.uuid] = obj.material;
                    obj.material = this.darkMaterial;
                }
            };

            restoreMaterial = (obj: any) => {
                if (this.materials[obj.uuid]) {
                    obj.material = this.materials[obj.uuid];
                    delete this.materials[obj.uuid];
                }
            };
        };
    };
}

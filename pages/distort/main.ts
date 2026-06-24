import * as THREE from "three";
import { ThreeHelper } from "@/src/ThreeHelper";
import { MethodBaseSceneSet } from "@/src/ThreeHelper/decorators";
import { MainScreen } from "@/src/components/Three/Canvas";
import { Injectable } from "@/src/ThreeHelper/decorators/DI";
import type { GUI } from "dat.gui";
import { gsap } from "gsap";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader";
import { MeltingPass } from "./melting";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { MousePass } from "./MousePass";

@Injectable
export class Main extends MainScreen {
    static instance: Main;
    clock = new THREE.Clock();
    iTime = { value: 1 };
    iProgress = { value: 0 };
    effectComposer?: EffectComposer;
    size = new THREE.Vector2();
    meltingPass?: MeltingPass;

    constructor(private helper: ThreeHelper) {
        super(helper);
        helper.main = this;
        Main.instance = this;

        const { ScrollTrigger } = require("gsap/ScrollTrigger");

        gsap.registerPlugin(ScrollTrigger);

        this.init();
    }

    @MethodBaseSceneSet({
        addAxis: false,
        cameraPosition: new THREE.Vector3(0, 0, 50),
        cameraTarget: new THREE.Vector3(0, 0, 0),
        useRoomLight: false,
    })
    init() {
        this.addEffectComposer();

        this.handleScene();
    }

    addEffectComposer() {
        const { helper } = this;

        const effectComposer = new EffectComposer(helper.renderer as THREE.WebGLRenderer);

        this.effectComposer = effectComposer;

        const renderPass = new RenderPass(helper.scene, helper.camera);
        effectComposer.addPass(renderPass);

        const pixelRatio = helper.renderer.getPixelRatio();

        helper.renderer.getSize(this.size).multiplyScalar(pixelRatio);

        const resolution = new THREE.Vector2(1 / this.size.x, 1 / this.size.y);

        const mousePass = new MousePass({ iTime: this.iTime });

        const meltingPass = new MeltingPass({
            camera: helper.camera,
            iTime: this.iTime,
            mouseTexture: mousePass.renderTarget,
        });

        this.meltingPass = meltingPass;

        effectComposer.addPass(meltingPass);

        const fxaaPass = new ShaderPass(FXAAShader);

        fxaaPass.uniforms["resolution"].value.copy(resolution);

        this.helper.addResizeListen(() => {
            const pixelRatio = helper.renderer.getPixelRatio();

            helper.renderer.getSize(this.size).multiplyScalar(pixelRatio);

            fxaaPass.uniforms["resolution"].value.set(1 / this.size.x, 1 / this.size.y);
        });

        effectComposer.addPass(fxaaPass);

        const outputPass = new OutputPass();

        effectComposer.addPass(outputPass);

        helper.render = () => {
            mousePass.render();
            effectComposer.render();
        };
    }

    handleScene() {
        this.addTitle();
    }

    addTitle() {
        const map = this.helper.loadTexture("/public/textures/title2.png", (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
        });

        const plane = this.helper.create.plane(40, 20).add();

        if (this.meltingPass) {
            const m = this.meltingPass.material.clone();

            m.uniforms.ease.value = 1;
            m.uniforms.tMouseTexture.value = null;
            m.uniforms.tPictureScene.value = map;
            m.uniforms.alpha.value = 1;

            plane.material(m);

            const ScrollElement = document.querySelector("#ScrollElement");

            if (!ScrollElement) throw new Error("ScrollElement not found");

            const titleOpacity = (opacity: 0 | 1) => {
                gsap.killTweensOf(m.uniforms.alpha);

                gsap.fromTo(
                    m.uniforms.alpha,
                    { value: 1 - opacity },
                    {
                        value: opacity,
                        duration: 1,
                        onUpdate: () => {
                            m.uniforms.ease.value = m.uniforms.alpha.value * 0.1 + 0.9;
                        },
                    }
                );
            };

            gsap.to(plane.mesh.position, {
                y: 10,
                ease: "power2.in",
                scrollTrigger: {
                    trigger: ScrollElement,
                    start: 0,
                    end: innerHeight / 2,
                    scrub: true,
                    onEnterBack: () => {
                        titleOpacity(1);
                    },
                    onLeave: () => {
                        titleOpacity(0);
                    },
                },
            });

            gsap.to(m.uniforms.distB, {
                value: 20,
                ease: "power2.in",
                scrollTrigger: {
                    trigger: ScrollElement,
                    start: 0,
                    end: innerHeight / 2,
                    scrub: true,
                },
            });
        }
    }

    @ThreeHelper.InjectAnimation(Main)
    animation() {
        const delta = this.clock.getDelta();
        this.iTime.value += delta / 3;
    }

    @ThreeHelper.AddGUI(Main)
    Gui(gui: GUI) {
        if (this.meltingPass) {
            // const easeBar = gui.add(this.meltingPass.uniforms.ease, "value", 0, 1).step(0.001).name("ease");
        }

        gui.hide();
        // const progressBar = gui.add(this.iProgress, "value", 0, 1).step(0.001);

        // const play = () => {
        //     this.iProgress.value = 0;

        //     gsap.to(this.iProgress, {
        //         value: 1,
        //         duration: 1,
        //         onUpdate: () => {
        //             progressBar.updateDisplay();
        //         },
        //         onComplete: () => {},
        //     });
        // };

        // gui.addFunction(() => play()).name("play");
    }
}

class BaseMaterial extends THREE.ShaderMaterial {
    constructor(params: { map: THREE.Texture; rotationFactor: { value: number } }) {
        super({
            uniforms: {
                map: { value: params.map },
                rotationFactor: params.rotationFactor,
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                uniform float rotationFactor; 
                uniform float normalized; 

                mat4 adjustRotation(mat4 matrix, float rotationFactor) {
                    // 创建一个新的矩阵以保存结果
                    mat4 result = matrix;
                
                    // 提取缩放因子，保存在对角线位置
                    result[0][0] = length(vec3(matrix[0][0], matrix[1][0], matrix[2][0]));
                    result[1][1] = length(vec3(matrix[0][1], matrix[1][1], matrix[2][1]));
                    result[2][2] = length(vec3(matrix[0][2], matrix[1][2], matrix[2][2]));
                
                    // 控制旋转部分的影响，根据rotationFactor线性插值
                    result[0][1] = matrix[0][1] * rotationFactor;
                    result[0][2] = matrix[0][2] * rotationFactor;
                    result[1][0] = matrix[1][0] * rotationFactor;
                    result[1][2] = matrix[1][2] * rotationFactor;
                    result[2][0] = matrix[2][0] * rotationFactor;
                    result[2][1] = matrix[2][1] * rotationFactor;
                
                    return result;
                }
                
                void main() {
                    vUv = uv;

                    vec4 transformed = vec4(position, 1.0);

                    // Tip: 应该在GPU中计算好 因为旋转矩阵，只要计算一次就足够了，不用每一次顶点都要计算，不过当前作用在平面上一共就四个点，计算不大
                    mat4 adjustRotationMatrix = adjustRotation(modelViewMatrix,rotationFactor);

                    vec4 modelPosition = adjustRotationMatrix * transformed;

                    gl_Position = projectionMatrix * modelPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec2 vUv;
                uniform sampler2D map;

                void main() {
                   
                    vec3 color = texture2D(map,vUv).rgb;
                    
                    gl_FragColor = vec4(color , 1.); 
                }
            `,
        });
    }
}

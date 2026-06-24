/*
 * @Author: hongbin
 * @Date: 2024-09-07 18:52:25
 * @LastEditors: hongbin
 * @LastEditTime: 2024-10-25 11:40:52
 * @Description:
 * 渲染多次（正常渲染 法线 粗糙度渲染 基础颜色 黑白穿梭区域）
 * 可优化：正常渲染中的阴影保留 颜色变为基础颜色 可少渲染一次
 */
import vertexShader from "./vertex.glsl";
import fragmentShader from "./fragment.glsl";
import { ShaderMaterial, Vector2 } from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass";
import * as THREE from "three";
import { DepthShader } from "../DepthShader";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader";
import { MixShader } from "../MixShader";
import BrightnessFragment from "./BrightnessFragment.glsl";
import HighlightsFragment from "./HighlightsFragment.glsl";
import { ShuttleGateShader } from "../ShuttleGateShader";

const MoebiusShader = new ShaderMaterial({
    uniforms: {
        tDiffuse: { value: null },
        depthTexture: { value: null },
        normalTexture: { value: null },
        resolution: { value: new Vector2() },
        samplerTexture: { value: null },
        uIntensity: { value: 1 },
        uScalar: { value: 1 },
        brightnessStep: {
            value: {
                b1: 0.27,
                b2: 0.3,
                b3: 0.15,
            },
        },
        lineTexture: {
            value: null,
        },
        horizontalLineTexture: {
            value: null,
        },
        verticalLineTexture: {
            value: null,
        },
    },
    // blending: AdditiveBlending,
    // transparent: true,
    vertexShader,
    fragmentShader,
});

interface PointLightUniforms {
    color: THREE.PointLight["color"];
    decay: THREE.PointLight["decay"];
    position: THREE.PointLight["position"];
    distance: THREE.PointLight["distance"];
    visible: THREE.PointLight["visible"];
}

export enum MoebiusPassSamplerMode {
    Default = 1,
    Depth = 2,
    Normal = 3,
}

export enum MoebiusPassOutput {
    Default = 1,
    Depth = 2,
    Normal = 3,
    GrowDepth = 4,
    GrowNormal = 5,
    DepthEdgeDetection = 6,
    BrightnessMaterial = 7,
    /** 查看高光区域 (电光源) */
    Highlights = 8,
    BaseColor = 9,
    Doors = 10,
}

export class MoebiusPass extends Pass {
    samplerMode = MoebiusPassSamplerMode.Normal;

    output = MoebiusPassOutput.Default;
    // output = MoebiusPassOutput.Highlights;

    textureID: string;
    fsQuad: FullScreenQuad;
    material = MoebiusShader;
    uniforms = MoebiusShader.uniforms;
    depthMaterial: ShaderMaterial;
    normalMaterial = new THREE.MeshNormalMaterial();
    copyMaterial: ShaderMaterial;
    mixMaterial: ShaderMaterial;
    depthSampleRenderTarget: THREE.WebGLRenderTarget<THREE.Texture>;
    templateRenderTarget: THREE.WebGLRenderTarget<THREE.Texture>;
    highlightsRenderTarget: THREE.WebGLRenderTarget<THREE.Texture>;
    roughnessRenderTarget: THREE.WebGLRenderTarget<THREE.Texture>;
    baseMaterialRenderTarget: THREE.WebGLRenderTarget<THREE.Texture>;
    templateRenderTarget2: THREE.WebGLRenderTarget<THREE.Texture>;
    BrightnessMaterial?: ShaderMaterial;
    HighlightsMaterial?: ShaderMaterial;
    shuttleGateMaterial?: ShaderMaterial;
    reversal: "mix1" | "mix2" | "1" | "2" = "mix1";
    reversalTag: "1" | "2" = "1";

    constructor(
        public params: {
            depthTexture: { value: THREE.Texture };
            normalTexture: { value: THREE.Texture };
            normalRenderTarget: { value: THREE.WebGLRenderTarget };
            doorsRenderTarget: { value: THREE.Texture };
            camera: THREE.PerspectiveCamera;
            pointLightPosition: THREE.Vector3;
            scene: THREE.Scene;
            width: number;
            height: number;
        }
    ) {
        super();
        this.params = params;
        this.textureID = "tDiffuse";

        this.fsQuad = new FullScreenQuad(this.material);

        this.depthSampleRenderTarget = new THREE.WebGLRenderTarget(params.width, params.height);
        this.templateRenderTarget = new THREE.WebGLRenderTarget(params.width, params.height);
        this.highlightsRenderTarget = new THREE.WebGLRenderTarget(params.width, params.height);
        this.roughnessRenderTarget = new THREE.WebGLRenderTarget(params.width, params.height);
        this.baseMaterialRenderTarget = new THREE.WebGLRenderTarget(params.width, params.height);
        this.templateRenderTarget2 = new THREE.WebGLRenderTarget(params.width, params.height);

        this.mixMaterial = new THREE.ShaderMaterial({ ...MixShader });
        this.shuttleGateMaterial = new THREE.ShaderMaterial({ ...ShuttleGateShader });

        this.depthMaterial = new THREE.ShaderMaterial({ ...DepthShader, blending: 0 });
        this.depthMaterial.uniforms["tDepth"].value = params.depthTexture.value;
        this.depthMaterial.uniforms["cameraNear"].value = params.camera.near;
        this.depthMaterial.uniforms["cameraFar"].value = params.camera.far;

        this.copyMaterial = new ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
            vertexShader: CopyShader.vertexShader,
            fragmentShader: CopyShader.fragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blendSrc: THREE.DstColorFactor,
            blendDst: THREE.ZeroFactor,
            blendEquation: THREE.AddEquation,
            blendSrcAlpha: THREE.DstAlphaFactor,
            blendDstAlpha: THREE.ZeroFactor,
            blendEquationAlpha: THREE.AddEquation,
        });

        this.uniforms.lineTexture.value = new THREE.TextureLoader().load("/textures/line2.png", (data) => {
            data.wrapS = THREE.RepeatWrapping;
            data.wrapT = THREE.RepeatWrapping;
        });

        // this.uniforms.horizontalLineTexture.value = new THREE.TextureLoader().load(
        //     "/textures/hangar_concrete_floor_diff_1k.jpg",
        //     (data) => {
        //         data.wrapS = THREE.RepeatWrapping;
        //         data.wrapT = THREE.RepeatWrapping;
        //     }
        // );

        // this.uniforms.verticalLineTexture.value = new THREE.TextureLoader().load(
        //     "/textures/patterned_clay_plaster_diff_1k.jpg",
        //     (data) => {
        //         data.wrapS = THREE.RepeatWrapping;
        //         data.wrapT = THREE.RepeatWrapping;
        //     }
        // );

        this.uniforms.normalTexture.value = this.params.normalRenderTarget.value.texture;

        this.otherEffect();
    }

    addITime(delta: number) {
        this.shuttleGateMaterial && (this.shuttleGateMaterial.uniforms["iTime"].value += delta);
    }

    setITime(time: number) {
        this.shuttleGateMaterial && (this.shuttleGateMaterial.uniforms["iTime"].value = time);
    }

    render(
        renderer: THREE.WebGLRenderer,
        writeBuffer: THREE.WebGLRenderTarget,
        readBuffer: THREE.WebGLRenderTarget /*, deltaTime, maskActive */
    ) {
        if (this.output == MoebiusPassOutput.GrowNormal) {
            // this.renderPass(renderer, this.depthMaterial, writeBuffer);
            // this.uniforms["tDiffuse"].value = readBuffer.texture;
            // this.uniforms["samplerTexture"].value = writeBuffer.texture;
            // this.uniforms["uIntensity"].value = 10;
            // this.fsQuad.material = this.material;
            // renderer.setRenderTarget(this.depthSampleRenderTarget);
            // this.fsQuad.render(renderer);
            // this.showRenderTarget(renderer, this.depthSampleRenderTarget, writeBuffer);
            // this.mixMaterial.uniforms["aTexture"].value = this.depthSampleRenderTarget.texture;
            // this.mixMaterial.uniforms["bTexture"].value = this.params.normalTexture.value;
            // this.renderPass(renderer, this.mixMaterial, this.templateRenderTarget);
            // this.uniforms["tDiffuse"].value = readBuffer.texture;
            // this.uniforms["samplerTexture"].value = this.templateRenderTarget.texture;
            // this.uniforms["uIntensity"].value = 1;
            // this.fsQuad.material = this.material;
            // renderer.setRenderTarget(writeBuffer);
            // this.fsQuad.render(renderer);
        } else if (this.output == MoebiusPassOutput.GrowDepth) {
            // 渲染深度信息
            // this.renderPass(renderer, this.depthMaterial, writeBuffer);
            // // 深度边缘检测
            // this.uniforms["tDiffuse"].value = readBuffer.texture;
            // this.uniforms["samplerTexture"].value = writeBuffer.texture;
            // this.uniforms["uIntensity"].value = 1;
            // this.fsQuad.material = this.material;
            // renderer.setRenderTarget(this.depthSampleRenderTarget);
            // this.fsQuad.render(renderer);
            // this.showRenderTarget(renderer, this.depthSampleRenderTarget, writeBuffer);
            // 法线+深度边缘检测
            // this.mixMaterial.uniforms["aTexture"].value = this.depthSampleRenderTarget.texture;
            // this.mixMaterial.uniforms["bTexture"].value = this.params.normalTexture.value;
            // this.renderPass(renderer, this.mixMaterial, this.templateRenderTarget);
            // this.showRenderTarget(renderer, this.templateRenderTarget, writeBuffer);
            // 渲染最终边缘检测
            // this.uniforms["tDiffuse"].value = readBuffer.texture;
            // this.uniforms["samplerTexture"].value = this.templateRenderTarget.texture;
            // this.uniforms["uIntensity"].value = 1;
            // this.fsQuad.material = this.material;
            // renderer.setRenderTarget(writeBuffer);
            // this.fsQuad.render(renderer);
        } else if (this.output == MoebiusPassOutput.DepthEdgeDetection) {
            // 渲染深度信息
            this.renderPass(renderer, this.depthMaterial, this.templateRenderTarget);
            // 查看 上一步的渲染深度信息 解锁下方代码 注释其他下方代码
            // this.copyMaterial.uniforms["tDiffuse"].value = this.templateRenderTarget.texture;
            // this.copyMaterial.blending = THREE.NoBlending;
            // this.renderPass(renderer, this.copyMaterial, writeBuffer);

            // 深度边缘检测
            this.uniforms["tDiffuse"].value = readBuffer.texture;
            this.uniforms["samplerTexture"].value = this.templateRenderTarget.texture;
            this.uniforms["uIntensity"].value = 1;
            this.fsQuad.material = this.material;
            renderer.setRenderTarget(writeBuffer);
            this.fsQuad.render(renderer);
        } else if (this.output == MoebiusPassOutput.Depth) {
            this.renderPass(renderer, this.depthMaterial, writeBuffer);
        } else if (this.output == MoebiusPassOutput.Normal) {
            this.copyMaterial.uniforms["tDiffuse"].value = this.params.normalRenderTarget.value.texture;
            this.copyMaterial.blending = THREE.NoBlending;
            this.renderPass(renderer, this.copyMaterial, writeBuffer);
        } else if (this.output == MoebiusPassOutput.Doors) {
            this.copyMaterial.uniforms["tDiffuse"].value = this.params.doorsRenderTarget.value;
            this.copyMaterial.blending = THREE.NoBlending;
            this.renderPass(renderer, this.copyMaterial, writeBuffer);
        } else if (this.output == MoebiusPassOutput.BrightnessMaterial) {
            if (this.BrightnessMaterial) {
                this.BrightnessMaterial.uniforms["tDiffuse"].value = readBuffer.texture;
                this.BrightnessMaterial.blending = THREE.NoBlending;
                this.renderPass(renderer, this.BrightnessMaterial, writeBuffer);
            }
        } else if (this.output == MoebiusPassOutput.Highlights) {
            // if (this.HighlightsMaterial) {
            //     this.renderHighlights(renderer, writeBuffer);
            // }
            this.copyMaterial.uniforms["tDiffuse"].value = this.params.normalTexture.value;
            this.copyMaterial.blending = THREE.NoBlending;
            this.renderPass(renderer, this.copyMaterial, writeBuffer);
        } else if (this.output == MoebiusPassOutput.BaseColor) {
            if (this.params.scene.toggleRoughnessMaterial) {
                this.params.scene.toggleRoughnessMaterial("base");
                const RenderTarget = renderer.getRenderTarget();
                renderer.setRenderTarget(writeBuffer);
                renderer.render(this.params.scene, this.params.camera);
                this.params.scene.toggleRoughnessMaterial("default");
                renderer.setRenderTarget(RenderTarget);
            }
        } else {
            this.uniforms["tDiffuse"].value = readBuffer.texture;
            if (this.samplerMode == MoebiusPassSamplerMode["Default"]) {
                this.uniforms["samplerTexture"].value = readBuffer.texture;
            } else if (this.samplerMode == MoebiusPassSamplerMode["Depth"]) {
                this.uniforms["samplerTexture"].value = this.params.depthTexture.value;
            } else if (this.samplerMode == MoebiusPassSamplerMode["Normal"]) {
                this.uniforms["samplerTexture"].value = this.params.normalTexture.value;

                // this.renderHighlights(renderer, this.highlightsRenderTarget);
                // this.uniforms["samplerTexture"].value = this.highlightsRenderTarget.texture;

                if (this.params.scene.toggleRoughnessMaterial) {
                    this.params.scene.toggleRoughnessMaterial("base");
                    const RenderTarget = renderer.getRenderTarget();
                    renderer.setRenderTarget(this.baseMaterialRenderTarget);
                    renderer.render(this.params.scene, this.params.camera);
                    this.params.scene.toggleRoughnessMaterial("default");
                    renderer.setRenderTarget(RenderTarget);
                }

                this.uniforms["baseColorTexture"] = { value: this.baseMaterialRenderTarget.texture };
                // this.uniforms["baseColorTexture"] = { value: null };
            }

            this.fsQuad.material = this.material;

            if (this.renderToScreen) {
                renderer.setRenderTarget(null);
                this.fsQuad.render(renderer);
            } else {
                if (this.params.doorsRenderTarget.value && this.shuttleGateMaterial) {
                    // 正常渲染
                    renderer.setRenderTarget(this.templateRenderTarget);
                    this.fsQuad.render(renderer);

                    // 渲染一份只有线条没有颜色的纹理
                    renderer.setRenderTarget(this.templateRenderTarget2);
                    this.uniforms["baseColorTexture"] = { value: null };
                    this.fsQuad.render(renderer);
                    // 混合两层纹理
                    this.fsQuad.material = this.shuttleGateMaterial;
                    if (this.reversal == "mix1") {
                        this.shuttleGateMaterial.uniforms["aTexture"] = { value: this.templateRenderTarget.texture };
                        this.shuttleGateMaterial.uniforms["bTexture"] = { value: this.templateRenderTarget2.texture };
                        this.shuttleGateMaterial.uniforms["cTexture"] = { value: this.params.doorsRenderTarget.value };
                    }
                    /** TODO 接近时 就全设置为下一个颜色的模式 过了之后再恢复混合 所以视频中的门也是过了片刻显示另一个颜色模式的 无法平滑过渡使用此种方式替代*/
                    if (this.reversal == "mix2") {
                        this.shuttleGateMaterial.uniforms["aTexture"] = { value: this.templateRenderTarget2.texture };
                        this.shuttleGateMaterial.uniforms["bTexture"] = { value: this.templateRenderTarget.texture };
                        this.shuttleGateMaterial.uniforms["cTexture"] = { value: this.params.doorsRenderTarget.value };
                    }
                    if (this.reversal == "1") {
                        this.shuttleGateMaterial.uniforms["aTexture"] = { value: this.templateRenderTarget.texture };
                        this.shuttleGateMaterial.uniforms["bTexture"] = { value: this.templateRenderTarget.texture };
                        this.shuttleGateMaterial.uniforms["cTexture"] = { value: this.params.doorsRenderTarget.value };
                    }
                    if (this.reversal == "2") {
                        this.shuttleGateMaterial.uniforms["aTexture"] = { value: this.templateRenderTarget2.texture };
                        this.shuttleGateMaterial.uniforms["bTexture"] = { value: this.templateRenderTarget2.texture };
                        this.shuttleGateMaterial.uniforms["cTexture"] = { value: this.params.doorsRenderTarget.value };
                    }
                    renderer.setRenderTarget(writeBuffer);
                    this.fsQuad.render(renderer);
                } else 
                {
                    renderer.setRenderTarget(writeBuffer);
                    // TODO: Avoid using autoClear properties, see https://github.com/mrdoob/three.js/pull/15571#issuecomment-465669600
                    if (this.clear)
                        renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
                    this.fsQuad.render(renderer);
                }
            }
        }
    }

    showRenderTarget(
        renderer: THREE.WebGLRenderer,
        renderTarget: THREE.WebGLRenderTarget,
        writeBuffer: THREE.WebGLRenderTarget
    ) {
        this.copyMaterial.uniforms["tDiffuse"].value = renderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, writeBuffer);
    }

    renderPass(
        renderer: THREE.WebGLRenderer,
        passMaterial: THREE.Material,
        renderTarget: THREE.WebGLRenderTarget,
        clearColor?: number,
        clearAlpha?: number
    ) {
        // const originalClearColor = new THREE.Color();
        // // save original state
        // renderer.getClearColor(originalClearColor);
        // const originalClearAlpha = renderer.getClearAlpha();
        // const originalAutoClear = renderer.autoClear;

        renderer.setRenderTarget(renderTarget);

        // setup pass state
        // renderer.autoClear = false;
        // if (clearColor !== undefined && clearColor !== null) {
        //     renderer.setClearColor(clearColor);
        //     renderer.setClearAlpha(clearAlpha || 0.0);
        //     renderer.clear();
        // }

        this.fsQuad.material = passMaterial;
        this.fsQuad.render(renderer);

        // restore original state
        // renderer.autoClear = originalAutoClear;
        // renderer.setClearColor(originalClearColor);
        // renderer.setClearAlpha(originalClearAlpha);
    }

    originalClearColor = new THREE.Color();

    renderOverride(
        renderer: THREE.WebGLRenderer,
        overrideMaterial: THREE.Material & {
            clearColor?: THREE.ColorRepresentation;
            clearAlpha?: number;
        },
        renderTarget: THREE.WebGLRenderTarget,
        clearColor?: THREE.ColorRepresentation,
        clearAlpha?: number
    ) {
        renderer.getClearColor(this.originalClearColor);
        const originalClearAlpha = renderer.getClearAlpha();
        const originalAutoClear = renderer.autoClear;

        renderer.setRenderTarget(renderTarget);
        renderer.autoClear = false;

        clearColor = overrideMaterial.clearColor || clearColor;
        clearAlpha = overrideMaterial.clearAlpha || clearAlpha;

        if (clearColor !== undefined && clearColor !== null) {
            renderer.setClearColor(clearColor);
            renderer.setClearAlpha(clearAlpha || 0.0);
            renderer.clear();
        }

        this.params.scene.overrideMaterial = overrideMaterial;
        renderer.render(this.params.scene, this.params.camera);
        this.params.scene.overrideMaterial = null;

        // restore original state

        renderer.autoClear = originalAutoClear;
        renderer.setClearColor(this.originalClearColor);
        renderer.setClearAlpha(originalClearAlpha);
    }

    dispose() {
        this.material.dispose();

        this.fsQuad.dispose();
    }

    otherEffect() {
        this.BrightnessMaterial = new ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
            vertexShader: CopyShader.vertexShader,
            fragmentShader: BrightnessFragment,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blendSrc: THREE.DstColorFactor,
            blendDst: THREE.ZeroFactor,
            blendEquation: THREE.AddEquation,
            blendSrcAlpha: THREE.DstAlphaFactor,
            blendDstAlpha: THREE.ZeroFactor,
            blendEquationAlpha: THREE.AddEquation,
        });

        const replaceLightNums = (string: string, parameters: { numPointLights: number }) => {
            return string.replace(/NUM_POINT_LIGHTS/g, "" + parameters.numPointLights);
        };

        const PointLights = this.getPointLights(this.params.scene, this.params.camera);

        this.HighlightsMaterial = new ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone({
                ...CopyShader.uniforms,
                depthTexture: { value: this.params.depthTexture.value },
                cameraNear: { value: this.params.camera.near },
                cameraFar: { value: this.params.camera.far },
                cameraProjectionMatrix: { value: this.params.camera.projectionMatrix },
                cameraInverseProjectionMatrix: { value: this.params.camera.projectionMatrixInverse },
                pointLights: {
                    value: PointLights,
                },
            }),
            defines: { RECIPROCAL_PI: 1 / Math.PI },
            vertexShader: CopyShader.vertexShader,
            fragmentShader: replaceLightNums(HighlightsFragment, { numPointLights: PointLights.length }),
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blendSrc: THREE.DstColorFactor,
            blendDst: THREE.ZeroFactor,
            blendEquation: THREE.AddEquation,
            blendSrcAlpha: THREE.DstAlphaFactor,
            blendDstAlpha: THREE.ZeroFactor,
            blendEquationAlpha: THREE.AddEquation,
        });

        // this.HighlightsMaterial.onBeforeRender = () => {
        //     const _PointLights = this.getPointLights(this.params.scene, this.params.camera);

        //     this.HighlightsMaterial!.uniforms.pointLights.value = _PointLights;
        // };
    }

    getPointLights(scene: THREE.Scene, camera: THREE.Camera) {
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

        return PointLights;
    }

    renderHighlights(
        renderer: THREE.WebGLRenderer,
        renderTarget: THREE.WebGLRenderTarget,
        roughnessBuffer?: THREE.WebGLRenderTarget["texture"]
    ) {
        // const _PointLights = this.getPointLights(this.params.scene, this.params.camera);

        // this.HighlightsMaterial!.uniforms.pointLights.value = _PointLights;
        // 多点光 不知道为什么 热更新时 报错 遂使用单点光
        this.HighlightsMaterial!.uniforms["tDiffuse"].value = this.params.normalRenderTarget.value.texture;

        //额外渲染一次 获取物体的粗糙度以设置不同物体的直接反射光照强度
        if (this.params.scene.toggleRoughnessMaterial) {
            this.params.scene.toggleRoughnessMaterial("roughness");
            const RenderTarget = renderer.getRenderTarget();
            renderer.setRenderTarget(this.roughnessRenderTarget);
            renderer.render(this.params.scene, this.params.camera);
            this.params.scene.toggleRoughnessMaterial("default");
            renderer.setRenderTarget(RenderTarget);
        }

        this.HighlightsMaterial!.uniforms["roughnessTexture"] = {
            value: roughnessBuffer || this.roughnessRenderTarget.texture,
        };

        // 暂时只采集一个点光的直接反射 (多个热更新时uniforms传递报错 未排查出问题 暂只使用一个点光)
        const point = this.params.scene.getObjectByProperty("type", "PointLight");
        if (point) {
            const pos = point.position.clone();
            pos.applyMatrix4(this.params.camera.matrixWorldInverse);
            this.HighlightsMaterial!.uniforms["tempPointLight"] = { value: pos };
        }

        this.HighlightsMaterial!.blending = THREE.NoBlending;
        this.renderPass(renderer, this.HighlightsMaterial!, renderTarget);
    }
}

/*
 * @Author: hongbin
 * @Date: 2022-12-10 08:23:15
 * @LastEditors: hongbin
 * @LastEditTime: 2024-11-03 17:38:01
 * @Description:Three.js 包装类
 */
import * as THREE from "three";
import { Mesh } from "three";
import { AnimationPlayer } from "./utils/AnimationPlayer";
import { BaseEnvironment } from "./utils/BaseEnvironment";
import { initGUI } from "./helper/gui";
import { stats } from "./helper/stats";
import { LinearAnimation } from "./utils/LinearAnimation";
import { GlbMesh, IBoxGeometry } from "./types/types";
import { RandomColor } from "./utils";
import { SkeletonAnimation } from "./utils/SkeletonAnimation";
import { KeyBoardListener } from "./utils/KeyBoardListener";
import { Create } from "./utils/Create";
import { RayMesh } from "./utils/RayMesh";
import WebGPURenderer, { WebGPURendererParameters } from "three/src/renderers/webgpu/WebGPURenderer.js";

// import { Mesh } from "./addons/Mesh";

type MixId<T> = T & { id?: number };

class List<T> {
    _list: MixId<T>[] = [];
    static catch: List<any>[] = [];

    constructor() {
        List.catch.push(this);
    }

    static _id: number;

    static get id() {
        return this._id;
    }

    static set id(id: number) {
        List._id = id;
        List.catch.forEach((item) => {
            if (item._list.length) {
                item._list = item._list.filter((f) => f.id == id - 1);
            }
        });
    }

    push(fn: MixId<T>) {
        this._list.push(fn);
        fn.id = List.id || 0;
    }

    forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any) {
        this._list.forEach(callbackfn, thisArg);
    }
}

/**
 * 继承的类构造函数参数类型[数组]
 */
type InheritClassParams = ConstructorParameters<typeof BaseEnvironment>;

export class ThreeHelper extends BaseEnvironment {
    frameHandle: number = 0;
    framing: boolean = false;
    protected _animation: VoidFunction = () => {};
    AnimationPlayer = AnimationPlayer;
    SkeletonAnimation = SkeletonAnimation;
    LinearAnimation = LinearAnimation;
    RandomColor = RandomColor;
    stats = stats;
    gui?: ReturnType<typeof initGUI>;
    clock = new THREE.Clock();
    static instance: ThreeHelper;
    runAnimate = true;
    create = Create;
    static handles = new List<VoidFunction>();
    static addGUIHandles = new List<
        ((gui: ReturnType<typeof initGUI>) => void) & {
            Main?: { instance?: any };
        }
    >();
    static Loaded = false;
    static id: number = 0;
    static UseGPURenderer = false;
    static WebGPURenderer?: WebGPURenderer;
    /** 实际控制页面的主类 */
    main?: Object;

    constructor(params: InheritClassParams[0]) {
        ThreeHelper.id += 1;

        super({ ...params, UseGPURenderer: ThreeHelper.UseGPURenderer });

        List.id = ThreeHelper.id;

        if (ThreeHelper.id > 1) {
            console.log(
                "%c%s",
                "background:#71f;border-radius:3px;padding: 2px 4px",
                "🚀 ThreeHelper Hot overload " + (ThreeHelper.id - 1)
            );
        } else {
            console.log("%c%s", "background:#51f;border-radius:3px;padding: 2px 4px", "🎉 ThreeHelper init success ");
        }

        if (ThreeHelper.Loaded && ThreeHelper.instance) return ThreeHelper.instance;

        ThreeHelper.instance = this;
        ThreeHelper.Loaded = true;
        ThreeHelper.onLoaded.forEach((fn) => fn());
        Reflect.defineMetadata("inject:class", ThreeHelper.instance, ThreeHelper);

        window.helper = this;
        window.THREE = THREE;
    }

    static onLoaded: VoidFunction[] = [];
    static loaded(call: VoidFunction) {
        ThreeHelper.onLoaded.push(() => call());
    }

    get(name: string) {
        return this.scene.getObjectByName(name);
    }

    /**
     * 添加性能指示器
     */
    addStats() {
        this.stats.init();
    }

    /**
     * 添加gui调试工具
     */
    addGUI(guiName?: string) {
        this.gui = initGUI(guiName);
        requestAnimationFrame(() => {
            this.gui &&
                ThreeHelper.addGUIHandles.forEach((fn) => {
                    // Main 是装饰器执行时插入的属性 用于保存instance 装饰器执行时 Main还未实例化 因此没有instance
                    fn?.Main?.instance && fn.call(fn.Main.instance, this.gui!);
                });
        });
    }

    /**
     * 向环境中添加物体
     */
    add(...object: THREE.Object3D[]) {
        this.scene.add(...object);
    }

    /**
     * 生成矩形 Generate Rectangle
     */
    static generateRect(geometryParams: IBoxGeometry, parameters?: THREE.MeshPhysicalMaterialParameters) {
        const geometry = new THREE.BoxGeometry(...Object.values(geometryParams));
        // const material = new THREE.MeshPhysicalMaterial(parameters);
        const material = new THREE.MeshStandardMaterial(parameters);
        const box = new THREE.Mesh(geometry, material);
        return box;
    }

    generateRect = ThreeHelper.generateRect;

    /**
     * 创建矩形
     */
    addRect(geometryParams: IBoxGeometry, parameters?: THREE.MeshPhysicalMaterialParameters) {
        const box = ThreeHelper.generateRect(geometryParams, parameters);
        this.add(box);
        //默认物体中心在世界坐标轴上 调整到下方对齐世界坐标轴
        box.position.y += geometryParams.height / 2;
        this.expandBoxTexture(box);
        return box;
    }

    createSphere = ThreeHelper.createSphere;

    /**
     * 创建球形
     */
    static createSphere(
        {
            radius,
            widthSegments,
            heightSegments,
        }: {
            radius: number;
            widthSegments?: number;
            heightSegments?: number;
        },
        parameters?: THREE.MeshStandardMaterialParameters | undefined
    ) {
        const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
        const material = new THREE.MeshStandardMaterial(parameters);
        const mesh = new Mesh(geometry, material);
        return mesh;
    }

    /**
     *拓展
     */
    expandBoxTexture(box: Mesh) {
        box.setBoxTexture = (...texts: string[]) => {
            const materials = texts.map((t) => new THREE.MeshStandardMaterial({ map: this.loadTexture(t) }));
            box.material = materials;
            materials.forEach((m) => {
                if (m.map) {
                    m.map.colorSpace = THREE.SRGBColorSpace;
                }
            });
        };
    }

    /**
     * 向物体上增加贴图
     */
    setMaterialMap(mesh: GlbMesh, map: string, onload?: VoidFunction) {
        if (mesh && !Array.isArray(mesh.material) && mesh.material) {
            mesh.material.map = this.loadTexture(map, (texture) => {
                texture.flipY = false;
                texture.colorSpace = THREE.SRGBColorSpace;
                onload && onload();
            });
        } else {
            console.log(mesh);
        }
    }

    /**
     * @description: 向物体上增加贴图
     * @param {THREE} scene 模型组
     * @param {string} childName 要设置贴图的子集name
     * @param {string} map 贴图url
     * @param {VoidFunction} onload 纹理加载贴图完毕的回调
     * @return {*}
     */
    setMaterialMapOnChild(childName: string, map: string, onload?: VoidFunction, scene?: THREE.Object3D) {
        const bottle = (scene || this.scene).getObjectByName(childName) as GlbMesh;
        if (bottle) this.setMaterialMap(bottle, map, onload);
        else return new Error(`未获取到模型中有 ${childName} 子集`);
    }

    /**
     * 镜头自动旋转
     */
    autoRotate() {
        if (this.controls) {
            this.controls.autoRotate = true;
            this.controls.enableRotate = true;
        }
    }

    /**
     * 设置每帧渲染执行的操作
     */
    animation(call: VoidFunction) {
        this._animation = call;
    }

    /**
     * 逐帧渲染 frame(帧)
     */
    frameByFrame() {
        this.frameHandle = requestAnimationFrame(() => this.frameByFrame());
        this.controls?.update();
        this.runAnimate && this._animation();
        this.render();
        this.stats.update();
        ThreeHelper.handles.forEach((x) => x());
    }

    /** 自动插入到animation中 逐帧执行 而不用将计算写到一个函数中 */
    static InjectAnimation(Main: { instance: any }): MethodDecorator {
        return (_, __, description: PropertyDescriptor) => {
            const prev = description.value;
            ThreeHelper.handles.push(() => {
                Main.instance && prev.call(Main.instance);
            });
        };
    }

    /** 创建gui控件 在初始化dat.gui后执行 可写多个 */
    static AddGUI(Main: { instance: any }): MethodDecorator {
        return (_, __, description: PropertyDescriptor) => {
            const prev = description.value;
            prev.Main = Main;
            ThreeHelper.addGUIHandles.push(prev);
        };
    }

    /**
     * 使用WebGPU渲染器 不使用此装饰器 默认使用WebGL渲染器
     */
    static useWebGPU<T extends { new (...args: any[]): {}; instance: {} }>(target: T) {
        ThreeHelper.UseGPURenderer = true;

        return class Payload extends target {
            constructor(...args: any[]) {
                super(...args);

                target.instance = this;
            }
        };
    }

    /**
     *  停止逐帧渲染
     */
    stopFrame() {
        cancelAnimationFrame(this.frameHandle);
        this.frameHandle = 0;
    }

    _box = new THREE.Box3();
    _vec3 = new THREE.Vector3();

    /** 获取物体的box3模型 */
    getBox3(obj: Object3D) {
        const box3 = this._box.setFromObject(obj);
        const prev = box3.getSize;
        box3.getSize = (vector3?: Vector3) => {
            if (vector3) {
                return prev.call(box3, vector3);
            } else {
                prev.call(box3, this._vec3);
                return this._vec3;
            }
        };
        {
            const prev = box3.getCenter;
            box3.getCenter = (vector3?: Vector3) => {
                if (vector3) {
                    return prev.call(box3, vector3);
                } else {
                    prev.call(box3, this._vec3);
                    return this._vec3;
                }
            };
        }
        return box3;
    }

    SkinnedToMesh(skinnedMesh: THREE.SkinnedMesh) {
        /**
         * Mesh默认射线贯穿机制：
         *   首先检测 boundingSphere 是否相交然后确认是否超出射线的距离
         *   然后检测是否与 boundingBox 相交
         * 优化：
         *  只检测 boundingBox 忽略 boundingSphere
         *  计算 boundingSphere 的距离需先获取 boundingBox 的中心 然后遍历所有顶点 计算半径 开销太大
         *  同步小范围 boundingBox 更新 减小开销
         */
        const box3 = new THREE.Box3();
        // const cloneTarget = new THREE.Mesh(
        const cloneTarget = new RayMesh(
            skinnedMesh.geometry.clone(),
            skinnedMesh.material && !Array.isArray(skinnedMesh.material)
                ? skinnedMesh.material.clone()
                : skinnedMesh.material.map((m) => m.clone())
        );
        const position = skinnedMesh.geometry.getAttribute("position");
        const cloneTargetPosition = cloneTarget.geometry.getAttribute("position");
        const cloneTargetNormal = cloneTarget.geometry.getAttribute("normal");
        const normal = skinnedMesh.geometry.getAttribute("normal");
        const skinIndex = skinnedMesh.geometry.getAttribute("skinIndex");
        const skinWeight = skinnedMesh.geometry.getAttribute("skinWeight");
        cloneTarget.geometry.boundingBox = box3;

        const boneTexture = (() => {
            if (!skinnedMesh.skeleton.boneTexture) {
                skinnedMesh.skeleton.computeBoneTexture();
                console.warn("应该在渲染一次过后再创建Mesh 手动调用computeBoneTexture创建的骨骼纹理可能无效");
            }
            return skinnedMesh.skeleton.boneTexture;
        })();

        if (!boneTexture) throw new Error("boneTexture is undefined");

        for (let i = 0; i < position.count; i++) {
            const i3 = i * 3;
            const i4 = i * 4;
            const transformPoint = (i: number, call?: (x: number, y: number, z: number) => void) =>
                this.transformPoint(
                    i,
                    boneTexture,
                    position,
                    skinIndex,
                    skinWeight,
                    skinnedMesh,
                    cloneTargetPosition,
                    cloneTargetNormal,
                    normal,
                    call
                );
            transformPoint(i, (x, y, z) => {
                // @ts-ignore
                box3.expandByPoint({ x, y, z });
            });
            this.bindBone(skinnedMesh, cloneTarget, skinIndex.array[i4], i3, transformPoint);
        }
        // cloneTarget.add(new THREE.Box3Helper(box3))

        // cloneTarget.geometry.computeBoundingSphere();
        // cloneTarget.geometry.computeBoundingBox();

        // cloneTarget.updateMatrix()
        // cloneTarget.updateMatrixWorld()
        // cloneTarget.matrix.copy(skinnedMesh.matrix)
        // cloneTarget.matrixWorld.copy(skinnedMesh.matrixWorld)

        // console.log('cloneTarget:', cloneTarget)
        // group.add(cloneTarget);
        // cloneTarget.geometry.deleteAttribute('skinIndex')
        // cloneTarget.geometry.deleteAttribute('skinWeight')
        return cloneTarget;
    }

    transformPoint(
        i: number,
        boneTexture: THREE.Texture,
        position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        skinIndex: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        skinWeight: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        skinnedMesh: THREE.SkinnedMesh,
        cloneTargetPosition: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        cloneTargetNormal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
        call?: (x: number, y: number, z: number) => void
    ) {
        const i3 = i * 3;
        const i4 = i * 4;
        const coord = new THREE.Vector4(position.array[i3], position.array[i3 + 1], position.array[i3 + 2], 1);

        const boneMatX = this.getBoneMatrix(boneTexture, skinIndex.array[i4]);
        const boneMatY = this.getBoneMatrix(boneTexture, skinIndex.array[i4 + 1]);
        const boneMatZ = this.getBoneMatrix(boneTexture, skinIndex.array[i4 + 2]);
        const boneMatW = this.getBoneMatrix(boneTexture, skinIndex.array[i4 + 3]);

        const skinVertex = coord.applyMatrix4(skinnedMesh.bindMatrix);
        const skinned = new THREE.Vector4();
        skinned.addVectors(skinned, skinVertex.clone().applyMatrix4(boneMatX).multiplyScalar(skinWeight.array[i4]));
        skinned.addVectors(
            skinned,
            skinVertex
                .clone()
                .applyMatrix4(boneMatY)
                .multiplyScalar(skinWeight.array[i4 + 1])
        );
        skinned.addVectors(
            skinned,
            skinVertex
                .clone()
                .applyMatrix4(boneMatZ)
                .multiplyScalar(skinWeight.array[i4 + 2])
        );
        skinned.addVectors(
            skinned,
            skinVertex
                .clone()
                .applyMatrix4(boneMatW)
                .multiplyScalar(skinWeight.array[i4 + 3])
        );
        // transformed = ( bindMatrixInverse * skinned ).xyz;
        const transformed = skinned.applyMatrix4(skinnedMesh.bindMatrixInverse);
        cloneTargetPosition.setXYZ(i, transformed.x, transformed.y, transformed.z);
        call && call(transformed.x, transformed.y, transformed.z);
        const skinMatrix = new THREE.Matrix4().multiplyScalar(0);
        boneMatX.multiplyScalar(skinWeight.array[i4]);
        this.MatrixAdd(skinMatrix, boneMatX);
        boneMatY.multiplyScalar(skinWeight.array[i4 + 1]);
        this.MatrixAdd(skinMatrix, boneMatY);
        boneMatZ.multiplyScalar(skinWeight.array[i4 + 2]);
        this.MatrixAdd(skinMatrix, boneMatZ);
        boneMatW.multiplyScalar(skinWeight.array[i4 + 3]);
        this.MatrixAdd(skinMatrix, boneMatW);
        const m4 = skinnedMesh.bindMatrix.clone().multiply(skinMatrix).multiply(skinnedMesh.bindMatrixInverse);
        const objectNormal = new THREE.Vector3(normal.array[i3], normal.array[i3 + 1], normal.array[i3 + 2]);
        objectNormal.applyMatrix4(m4);
        cloneTargetNormal.array[i3] = objectNormal.x;
        cloneTargetNormal.array[i3 + 1] = objectNormal.y;
        cloneTargetNormal.array[i3 + 2] = objectNormal.z;
    }

    getBoneMatrix(boneTexture: THREE.Texture, index: number) {
        // 可以简化成这一行
        return new THREE.Matrix4().fromArray(boneTexture.source.data.data, index * 16);

        //下面是模拟shder的计算
        // const size = boneTexture!.source.data.width;
        // const j = index * 4;
        // const x = j % size;
        // // glsl float 转换 int  小数被丢弃 向下取整
        // const y = Math.floor(j / size);

        // const v1 = this.texelFetch(boneTexture, x, y, size);
        // const v2 = this.texelFetch(boneTexture, x + 1, y, size);
        // const v3 = this.texelFetch(boneTexture, x + 2, y, size);
        // const v4 = this.texelFetch(boneTexture, x + 3, y, size);

        // return new THREE.Matrix4().fromArray([...v1, ...v2, ...v3, ...v4]);
    }

    texelFetch(boneTexture: THREE.Texture, x: number, y: number, size: number) {
        const row = 4;
        const column = size * 4;
        return [
            boneTexture.source.data.data[x * row + y * column],
            boneTexture.source.data.data[x * row + y * column + 1],
            boneTexture.source.data.data[x * row + y * column + 2],
            boneTexture.source.data.data[x * row + y * column + 3],
        ];
    }

    MatrixAdd(m1: THREE.Matrix4, m2: THREE.Matrix4) {
        for (let index = 0; index < 16; index++) {
            m1.elements[index] += m2.elements[index];
        }
        return m1;
    }

    /**
     * SkinnedMesh转换Mesh后跟随骨骼更新
     * 1.绑定时 将bone影响的顶点保存到bone的userData.bindPosition
     * 2.更新时 将bone及其子集 重新计算顶点和法相位置
     */
    bindBone(
        skinnedMesh: THREE.SkinnedMesh,
        cloneTarget: THREE.Mesh,
        boneIndex: number,
        positionIndex: number,
        transformPoint: (i: number, call?: (x: number, y: number, z: number) => void) => void
    ) {
        const bone = skinnedMesh.skeleton.bones[boneIndex];

        if (bone) {
            bone.userData.bindPosition = [...(bone.userData.bindPosition || []), positionIndex];
            if (!bone.userData.updateTemplatePosition) {
                bone.userData.updateTemplatePosition = () => {
                    bone.traverse((b) => {
                        ((b.userData.bindPosition as number[]) || []).forEach((i3) => {
                            const i = i3 / 3;
                            if (!/\./.test("" + i))
                                transformPoint(i, (x, y, z) => {
                                    cloneTarget.geometry.boundingBox?.expandByPoint(
                                        // @ts-ignore
                                        { x, y, z }
                                    );
                                });
                        });
                    });

                    this.updateAttr(cloneTarget, "position");
                    this.updateAttr(cloneTarget, "normal");
                };
            }
        }
    }

    updateAttr(mesh: THREE.Mesh, attr = "position") {
        if (!mesh.geometry.getAttribute(attr).needsUpdate) {
            mesh.geometry.getAttribute(attr).needsUpdate = true;
        }
    }
}

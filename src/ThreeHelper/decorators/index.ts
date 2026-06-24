/*
 * @Author: hongbin
 * @Date: 2023-08-27 11:34:41
 * @LastEditors: hongbin
 * @LastEditTime: 2024-12-02 17:42:07
 * @Description:
 */
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { ThreeHelper } from "..";
import { Vector3 } from "three";

/**
 * 类装饰器
 * 相机注入
 * 接收类需要声明
 * private camera!: THREE.PerspectiveCamera;
 * private cameraWrapper!: THREE.Object3D;
 */
export function CameraInject<T extends { new (...args: any[]): {} }>(
    constructor: T
) {
    return class extends constructor {
        camera = ThreeHelper.instance.camera;
        cameraWrapper = ThreeHelper.instance.camera.parent;
    };
}

const defaultParams = {
    addAxis: false,
    useRoomLight: true,
    useSkyEnv: false,
    useLegacyLights: true,
    cameraPosition: new Vector3(0, 0, 10),
    cameraTarget: new Vector3(0, 0, 0),
    near: 0.01,
    far: 1000,
    pixelRatio: <number>(<unknown>undefined),
};
/**
 * 方法装饰器 - 基础环境参数设置
 */
export const MethodBaseSceneSet = (
    params?: Partial<typeof defaultParams>
): MethodDecorator => {
    return function (target, _, description: PropertyDescriptor) {
        const prev = <any>description.value;
        description.value = function () {
            try {
                const realParams = { ...defaultParams, ...params };
                const helper: ThreeHelper = (this as any).helper;
                realParams.addAxis && helper.addAxis();
                // helper.renderer.useLegacyLights = true;
                helper.camera.position.copy(realParams.cameraPosition);
                helper.controls.target.copy(realParams.cameraTarget);
                helper.stopFrame();
                helper.frameByFrame();
                helper.addGUI();
                realParams.useRoomLight && helper.useRoomEnvironment();
                realParams.useSkyEnv && helper.useSkyEnvironment();
                realParams.near && (helper.camera.near = realParams.near);
                realParams.far && (helper.camera.far = realParams.far);
                if (realParams.near || realParams.far)
                    helper.camera.updateProjectionMatrix();
                realParams.pixelRatio &&
                    helper.renderer.setPixelRatio(realParams.pixelRatio);
                prev.call(this,helper);
            } catch (error) {
                throw error;
            }
        };
    };
};

/**
 * 方法装饰器 - gltf加载装饰器
 */
export const LoadGLTF = (url: string): MethodDecorator => {
    if (!url) throw new Error("url 为空");
    return (_, __, description: PropertyDescriptor) => {
        const prev = description.value;
        // 不能使用尖头函数 会导致函数内部的this偏离
        description.value = async function () {
            return ThreeHelper.instance
                .loadGltf(url.replace(/\/public/, ""))
                .then((gltf: GLTF) => {
                    if (!gltf || !gltf.scene) throw new Error("模型解析出错");
                    prev.call(this, gltf);
                });
        };
    };
};

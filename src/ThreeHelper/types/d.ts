/*
 * @Author: hongbin
 * @Date: 2022-12-11 21:36:03
 * @LastEditors: hongbin
 * @LastEditTime: 2024-10-25 11:32:57
 * @Description:
 */

/**
 * 拓充类型
 */
declare module "three/src/objects/Mesh" {
    interface Mesh {
        me: "hongbin";
        /**
         * @description: 传递纹理 六张图片 顺序固定 (右 左 上 下 前 后)
         * @param {string} 右 right
         * @param {string} 左 left
         * @param {string} 上 upper
         * @param {string} 下 lower
         * @param {string} 前 front
         * @param {string} 后 after
         * @return {*} *
         */
        setBoxTexture?: (
            right: string,
            left: string,
            upper: string,
            lower: string,
            front: string,
            after: string
        ) => void;
        roughnessMaterial: any;
        prevMaterial: any;
    }
}

declare module "three/src/core/object3D" {
    // interface Object3DEventMap {
    //     roughnessMaterial: any;
    //     prevMaterial: any;
    // }
}
declare module "three/src/materials/ShaderMaterial" {
    interface ShaderMaterial {
        me: "hongbin";
        /**
         * @description 更改uniforms
         * - 默认更改太繁琐
         * - material.uniforms[key].value = value
         */
        updateUniforms: (key: string, val: any) => void;
        // updateUniforms?: (key: string, val: any) => void;
    }
}

declare module "three/src/math/Triangle" {
    interface Triangle {
        me: "hongbin";
        /**
         * @description 用于八叉树检测时返回碰撞物体所属哪个物体
         * 单独使用没有这个属性
         */
        mesh: Mesh;
        /**
         * @description 用于八叉树检测时将物体的面统计
         * 单独使用没有这个属性
         */
        name: string;
    }
}
declare module "dat.gui" {
    interface GUI {
        /** 添加一个函数 */
        addFunction: (fn: VoidFunction, name?: string) => GUIController;
    }
    interface GUIController {
        /** 添加一个函数 */
        addFunction: (fn: VoidFunction, name?: string) => GUIController;
    }
}

declare module "three/src/scenes/scene" {
    interface Scene {
        toggleRoughnessMaterial?: (
            type: "default" | "base" | "roughness" | "black" | "specular",
            hideObject?: string[]
        ) => void;
        curr: string;
    }
}

declare module "three/src/math/box3" {
    interface Box3 {
        /** ThreeHelper封装getSize重载方法 可以不传递参数 */
        getSize(): Vector3;
        /** ThreeHelper封装getSize重载方法  修复使用call指引this 警告  */
        getSize(...args: any[]): Vector3;

        getCenter(): Vector3;
        getCenter(...args: any[]): Vector3;
    }
}

export {};
// declare namespace ThreeHelper {
//     let frameHandle: number;
//     let framing: boolean;
//     const _animation: VoidFunction;
//     const AnimationPlayer: any;
//     const SkeletonAnimation: any;
//     const LinearAnimation: any;
//     const RandomColor: any;
//     const stats: any;
//     const gui: any;
//     const clock: THREE.Clock;
//     const instance: typeof ThreeHelper;
//     const runAnimate = true;
//     const create: any;
//     const handles: Array<VoidFunction>;
// }

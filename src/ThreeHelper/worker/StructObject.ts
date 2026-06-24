/*
 * @Author: hongbin
 * @Date: 2023-05-09 09:18:08
 * @LastEditors: hongbin
 * @LastEditTime: 2023-05-09 16:28:32
 * @Description: 结构化物体 将模型传递进worker供worker构建八叉树使用 因此可以不必加载材质、动画
 */
import * as THREE from "three";
import { IBaseProps, IMeshParams } from "./TypeStructObject";

/**
 * 生成基本参数 旋转 位移 缩放等属性
 */
const genBaseStruct = (obj: THREE.Object3D): IBaseProps => {
    // TODO：  userData中可能有函数 不能传递
    const { userData } = obj;

    obj.updateMatrix();

    return {
        type: obj.type,
        name: obj.name,
        uuid: obj.uuid,
        up: [obj.up.x, obj.up.y, obj.up.z],
        matrix: obj.matrix,
        userData,
        visible: obj.visible,
        children: genObject3DChildren(obj.children),
    };
};

/**
 * 生成物体参数
 */
const genMeshStruct = (mesh: THREE.Mesh) => {
    const { geometry } = mesh;

    return {
        geometry,
        ...genBaseStruct(mesh),
    };
};

/**
 * 生成子元素结构
 */
const genObject3DChildren = (children: THREE.Object3D[]) => {
    const childStruct: IBaseProps["children"] = [];
    for (const child of children) {
        if (child.type === "Mesh") {
            childStruct.push(genMeshStruct(child as THREE.Mesh));
        } else if (child.type === "Group" || child.type === "Object3D") {
            childStruct.push(genBaseStruct(child));
        } else if (child.type === "SkinnedMesh") {
            childStruct.push(genSkinnedMeshStruct(child as THREE.SkinnedMesh));
        } else if (child.type === "Bone") {
            // TODO
        }
    }
    return childStruct;
};

/**
 * 生成只包含几何数据的物体信息
 */
export const StructObject = (group: THREE.Object3D) => {
    // group.traverse((obj) => {
    //     obj.updateMatrix();
    // });
    const struct: IBaseProps = { ...genBaseStruct(group) };
    return struct;
};

const genSkinnedMeshStruct = (skinnedMesh: THREE.SkinnedMesh) => {
    const {
        geometry,
        material,
        bindMode,
        frustumCulled,
        bindMatrix,
        bindMatrixInverse,
        skeleton,
    } = skinnedMesh;
    console.warn(
        "未完成 待完善 目前可主线程加载模型 worker加载模型的动画  动画必须是线性插值 别的暂时无法生效"
    );
    return {
        geometry,
        material,
        bindMode,
        frustumCulled,
        ...genBaseStruct(skinnedMesh),
    };
};

// 解析数据生成有效three对象

/**
 * 复原mesh只包含顶点
 */
const genGeometry = (geometry: THREE.BufferGeometry) => {
    const geom = new THREE.BufferGeometry();
    const {
        attributes: { position, uv, normal },
        index,
    } = geometry;

    //处理几何坐标
    const attributes = {
        position: new THREE.BufferAttribute(
            (position as THREE.BufferAttribute).array,
            (position as THREE.BufferAttribute).itemSize,
            (position as THREE.BufferAttribute).normalized
        ),
    } as THREE.BufferGeometry["attributes"];

    geom.index = index
        ? new THREE.BufferAttribute(
              index.array,
              index.itemSize,
              index.normalized
          )
        : null;

    geom.attributes = attributes;

    return geom;
};

/**
 * 处理变换 matrix
 */
const setTransform = (params: IBaseProps, object: THREE.Object3D) => {
    const matrix = new THREE.Matrix4();
    matrix.elements = params.matrix.elements;
    object.uuid = params.uuid;
    object.name = params.name;
    //! object.matrix = matrix 不行 无法应用
    object.matrix = new THREE.Matrix4();
    object.up.set(...params.up);
    object.userData = params.userData;
    object.visible = params.visible;
    object.applyMatrix4(matrix);
};

const pressMesh = (meshParams: IMeshParams) => {
    const geometry = genGeometry(meshParams.geometry);

    const mesh = new THREE.Mesh(geometry);
    setTransform(meshParams, mesh);
    meshParams.children.length &&
        mesh.add(...pressChildren(meshParams.children));

    return mesh;
};

const pressGroup = (groupParams: IBaseProps) => {
    const group = new THREE.Group();
    setTransform(groupParams, group);
    groupParams.children.length &&
        group.add(...pressChildren(groupParams.children));
    return group;
};

const pressChildren = (children: (IBaseProps | IMeshParams)[]) => {
    const objectList: THREE.Object3D[] = [];
    for (const child of children) {
        if (child.hasOwnProperty("geometry")) {
            objectList.push(pressMesh(child as IMeshParams));
        } else if (["Group", "Object3D"].includes(child.type)) {
            objectList.push(pressGroup(child));
        } else {
            console.log("未处理类型");
        }
    }
    return objectList;
};

/**
 * 解析传入的结构化数据 生成有效的three.js物体
 */
export const StructObjectLoad = (params: IBaseProps) => {
    const model = pressGroup(params);
    return model;
};

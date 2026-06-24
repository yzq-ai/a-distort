/*
 * @Author: hongbin
 * @Date: 2023-02-25 12:06:52
 * @LastEditors: hongbin
 * @LastEditTime: 2023-05-09 14:57:45
 * @Description: 负责八叉树构建和碰撞的web worker
 */
import { Capsule } from "three/examples/jsm/math/Capsule";
import { Octree } from "../expand/Octree";
import { ObjectLoader } from "three";
import { IBaseProps } from "./TypeStructObject";
import { StructObjectLoad } from "./StructObject";

interface ICaptureParams {
    start: { x: number; y: number; z: number };
    end: { x: number; y: number; z: number };
    radius: number;
}

class BuildFromGraphNode {
    worldOctree!: Octree;
    playerCollider!: Capsule;
    computeID = 0;
    constructor() {
        this.init();
    }

    init() {
        this.playerCollider = new Capsule();
        this.worldOctree = new Octree();
    }

    collider(
        { start, end, radius }: ICaptureParams,
        triangle: THREE.Triangle[] = []
    ) {
        this.playerCollider.start.set(start.x, start.y, start.z);
        this.playerCollider.end.set(end.x, end.y, end.z);
        this.playerCollider.radius = radius;

        const result = this.worldOctree.capsuleIntersect(
            this.playerCollider,
            triangle
        );

        postMessage({
            type: "colliderResult",
            result,
        });
    }

    fromGraphNode(json: IBaseProps) {
        const start = performance.now();
        // const root = await new ObjectLoader().parseAsync(json);
        const root = StructObjectLoad(json);
        this.worldOctree.fromGraphNode(root);

        postMessage({
            type: "graphNodeBuildComplete",
            msg: `构建八叉树结构成功 用时 ${performance.now() - start}`,
            // graphNode: this.worldOctree,
        });
    }
}

const buildFromGraphNode = new BuildFromGraphNode();

/**
 * 监听主线程发来的数信息
 */
onmessage = function (e) {
    switch (e.data.type) {
        case "connect":
            postMessage({
                msg: "连接成功",
            });
            break;
        case "build":
            buildFromGraphNode.fromGraphNode(e.data.json);
            break;
        case "collider":
            // postMessage({
            //     type: "colliderResult",
            //     msg: "接收成功",
            //     collider: e.data.collider,
            // });
            buildFromGraphNode.collider(e.data.collider, e.data.triangles);
            break;
    }
};

export {};

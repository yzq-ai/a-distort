/*
 * @Author: hongbin
 * @Date: 2023-02-02 13:37:11
 * @LastEditors: hongbin
 * @LastEditTime: 2023-08-26 17:17:16
 * @Description: 八叉树控制器
 */
import * as THREE from "three";
import { Sphere, Vector3 } from "three";
import { Capsule } from "../expand/Capsule";
import { Octree } from "../expand/Octree";
import { Octree as WorkerOctree } from "../expand/WorkerOctree";
import { ThreeHelper } from "@/src/ThreeHelper";
import { OctreeHelper } from "three/examples/jsm/helpers/OctreeHelper";
import { GUI } from "dat.gui";
import { StructObject } from "../worker/StructObject";

interface VVector3 {
    x: number;
    y: number;
    z: number;
}

interface IWorkerSubTree {
    box: {
        isBox3: true;
        max: VVector3;
        min: VVector3;
    };
    triangles: { a: VVector3; b: VVector3; c: VVector3 }[];
    subTrees: IWorkerSubTree[];
}

export type OctreeResult =
    | {
          normal: Vector3;
          depth: number;
          meshuuid?: string;
          meshName?: string;
          meshNames?: Array<string | undefined>;
      }
    | false;

export class OctreeControls {
    private worldOctree: Octree;
    private worldWorldOctree?: WorkerOctree;
    playerCollider: Capsule;
    /** 是否在地上 */
    playerOnFloor = false;
    /** 构建八叉树完成 **/
    buildComplete = false;
    private _collide = (result: OctreeResult, vector: Vector3) => {};
    private _player?: Object3D;
    private _box = new THREE.Box3();
    private worker?: Worker;
    /** webWorker返回的normal时结构化的数据不存在vector3的方法只有xyz属性 将值放到这个向量上进行计算 */
    private resultNormal = new Vector3();
    /** 每一次位移距离的向亮 */
    private _translateVector = new Vector3();
    /** 每一次位移的方向和距离 不直接修改 capsule 通过这个向量来决定位移 通过阻力减小这个值 解决下坡闪烁问题 让其在下坡时唯一的方向顺着坡度乡下 有一个加速度使下坡平缓 */
    private _translateSpeed = new Vector3();
    private delta = 0;
    private startCapsule = new Capsule();
    private startPosition = new Vector3();
    /** 在使用webWorker时计算不是同步 标记当前计算完成才返回值 */
    computed = true;
    /** 额外的三角面参与碰撞检测 */
    triangles = [] as {
        a: THREE.Vector3;
        b: THREE.Vector3;
        c: THREE.Vector3;
        mesh: { name: string };
    }[];
    builded: VoidFunction | undefined;

    constructor(params?: {
        /**
         * 开启WebWorker进行碰撞检测
         * 需要注意的是这会导致代码不会按照顺序执行要等待webWorker返回结果
         * 所以需要立刻获取碰撞结果的操作需要注意写法可以写在碰撞检测回调中
         */
        useWebWorker?: boolean;
    }) {
        if (params && params.useWebWorker) this.useWebWorker();
        this.worldOctree = new Octree();
        this.playerCollider = new Capsule();
    }

    /**
     * 碰撞回调
     */
    collide(_collide: typeof this._collide) {
        this._collide = _collide;
    }

    /**
     * 与球体进行碰撞
     */
    sphereCollider(sphere: Sphere) {
        const result = this.worldOctree.sphereIntersect(sphere);
        return result;
    }

    private _colliderTranslate = new Vector3();
    private handleCollider(
        result: ReturnType<(typeof this.worldOctree)["capsuleIntersect"]>
    ) {
        this.playerOnFloor = false;
        if (result) {
            this.playerOnFloor = result.normal.y > 0;
            result.normal.y -= 0.00000001;
            this._colliderTranslate
                .set(0, 0, 0)
                .addScaledVector(result.normal, result.depth);
            this.playerCollider.translate(this._colliderTranslate);
        }
        if (this.isLog && result) {
            console.log(result, this.playerOnFloor);
        }
        // 计算位置的差值
        this._translateVector.sub(this.playerCollider.start).multiplyScalar(-1);
        this._collide(result, this._translateVector.clone());
        this.computed = true;
    }

    /**
     * 碰撞检测
     */
    playerCollisions(delta: number) {
        if (!this.computed) return console.log("webWorker返回慢了一次");
        if (!this.buildComplete) return (this.playerOnFloor = true);
        // 先保存之前的位置
        this._translateVector.copy(this.playerCollider.start);
        this.delta = delta;
        let damping = Math.exp(-20 * delta) - 1;

        // if (!this.playerOnFloor) {
        //     console.log(false);
        //     damping *= 0.1;
        // }

        this._translateSpeed.addScaledVector(this._translateSpeed, damping);
        this.playerCollider.translate(this._translateSpeed);
        this.computed = false;

        // 防止无限掉落
        if (this.playerCollider.start.y < -10) {
            this.playerCollider.copy(this.startCapsule);
            this.clearSpeed();
        }

        // 如果启用了webworker 交给worker处理
        if (this.worker) {
            this.worker.postMessage({
                type: "collider",
                collider: this.playerCollider,
                triangles: this.triangles,
            });
            return;
        }

        const world = this.worldWorldOctree
            ? this.worldWorldOctree
            : this.worldOctree;
        const result = world.capsuleIntersect(
            this.playerCollider
        ) as ReturnType<(typeof this.worldOctree)["capsuleIntersect"]>;
        this.handleCollider(result);
    }

    private isLog = false;
    console(gui?: GUI) {
        if (!gui) return;
        const folder = gui?.addFolder("八叉树");
        const plane = {
            log: () => {
                this.isLog = !this.isLog;
            },
            helper: () => {
                this.helper();
            },
            info: () => {
                console.log(this);
            },
        };
        folder.add(plane, "log").name("打印八叉树检测结果");
        folder.add(plane, "helper").name("查看八叉树碰撞体");
        folder.add(plane, "info").name("查看八叉树信息");
    }

    /**
     * 增量更新胶囊体的位置
     * 应同步人物的移动
     */
    translatePlayerCollider(v: Vector3) {
        // this.playerCollider.translate(v);
        this._translateSpeed.add(v);
    }

    /**
     * 清除方向加速度影响
     */
    clearSpeed() {
        this._translateSpeed.set(0, 0, 0);
    }

    /**
     * 直接更新胶囊体位置
     * 只在 this._translateSpeed 无法配合的情况下使用
     */
    addPlayerCollider(v: Vector3) {
        this.playerCollider.translate(v);
        // 启用worker时 值不会立刻同步 造成位置偏差 强行将值同步
        if (!this.computed) {
            // this._translateVector.copy(this.playerCollider.start);
            // or
            this._translateVector.add(v);
        }
    }

    playerBox3() {
        return this._box;
    }

    helper() {
        if (!this._player) return;
        const radius = this.playerCollider.radius;
        const start = this.playerCollider.start;
        const end = this.playerCollider.end;
        console.log(this.playerCollider.start);
        {
            const mesh = ThreeHelper.instance.generateRect(
                {
                    width: 1,
                    height: 0.01,
                    depth: 0.01,
                },
                { color: 0x00ffa0 }
            );
            mesh.position.copy(this.playerCollider.start);
            // mesh.position.y -= radius;
            ThreeHelper.instance.add(mesh);
        }
        {
            const mesh = ThreeHelper.instance.generateRect(
                {
                    width: 0.1,
                    height: 0.01,
                    depth: 0.01,
                },
                { color: 0xff3a00 }
            );
            mesh.position.copy(this.playerCollider.end);
            // mesh.position.y += radius;
            ThreeHelper.instance.add(mesh);
        }
        {
            this._player.updateWorldMatrix(false, false);

            const Capsule = new THREE.Group();
            Capsule.applyMatrix4(this._player.matrixWorld);

            const length = start.clone().sub(end).length();
            const geometry = new THREE.CapsuleGeometry(radius, length, 4, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                wireframe: true,
            });
            const capsule = new THREE.Mesh(geometry, material);
            Capsule.add(capsule);
            Capsule.position.y += length / 2 + radius;
            // this._player.add(Capsule);
            ThreeHelper.instance.add(Capsule);
        }
    }

    /**
     * 计算碰撞体的胶囊体(碰撞范围 胶囊的高度 和半径)
     */
    private computeCollider() {
        if (!this._player) throw new Error("未执行 player() 方法");
        const size = this._player.userData._size;
        // 半径取 宽和长 大的一侧
        const radius = (Math.max(size.x, size.z) / 2) * 1.5;
        const { x, y, z } = this._player.position;

        const collider = {
            // 头
            start: new THREE.Vector3(x, y + size.y - radius * 0.75, z),
            // 脚
            end: new THREE.Vector3(x, y + radius - 0.01, z),
            radius,
        };

        return collider;
    }

    /**
     * 传入玩家对象 计算玩家胶囊体的数据
     */
    player(obj: Object3D) {
        this._player = obj;
        const defaultCollider = this.computeCollider();

        this.startPosition.copy(defaultCollider.start);
        // ! webWorker刚计算可能会慢 导致这一次返回的移动位置等于人物的位置 造成人物位置偏差
        this._translateVector.copy(defaultCollider.start);

        this.playerCollider.start.copy(defaultCollider.start);
        this.playerCollider.end.copy(defaultCollider.end);
        this.playerCollider.radius = defaultCollider.radius;
        this.startCapsule.copy(this.playerCollider);
    }

    /**
     * 根据传入对象构建该对象的八叉树结构
     * 模型越大越耗时
     */
    fromGraphNode(obj: Object3D, call?: VoidFunction) {
        this.builded = call;
        if (this.worker) {
            // const modelStruct = ModelTranslate.generateWorkerStruct(obj);
            // console.log(modelStruct);

            const json = StructObject(obj);
            console.log(json);

            this.worker.postMessage({
                type: "build",
                json,
            });

            //! 使用toJSON和ObjectLoader 无法在web worker 中解析纹理 因其需要document会报错
            //! 遂自研函数 只传递几合数据 减小开销
            // obj.traverse((obj) => obj.updateMatrix());
            // this.worker.postMessage({
            //     type: "build",
            //     json: obj.toJSON(),
            // });
        } else {
            this.worldOctree.fromGraphNode(obj);
            console.log(this.worldOctree);
            // this.octreeHelper.update();
            this.buildComplete = true;
            call && call();
        }
    }

    /**
     * 格式化从web worker中拿到的八叉树结构
     * 开销也非常大虽然只是格式转变但要便利的次数依然十分庞大还是会对线程造成堵塞
     */
    private formatSubTrees(subTree: IWorkerSubTree) {
        const octree = new Octree();
        const min = new THREE.Vector3().copy(subTree.box.min as Vector3);
        const max = new THREE.Vector3().copy(subTree.box.max as Vector3);
        octree["box"] = new THREE.Box3(min, max);
        octree["triangles"] = subTree.triangles.map((triangle) => {
            const a = new THREE.Vector3().copy(triangle.a as Vector3);
            const b = new THREE.Vector3().copy(triangle.b as Vector3);
            const c = new THREE.Vector3().copy(triangle.c as Vector3);
            return new THREE.Triangle(a, b, c);
        });
        octree.subTrees = subTree.subTrees.map((subTree) =>
            this.formatSubTrees(subTree)
        );
        return octree;
    }

    /**
     * 使用从web worker 构建的八叉树结构
     */
    private updateGraphNode(subTree: IWorkerSubTree, call?: VoidFunction) {
        // const Octree = this.formatSubTrees(subTrees);
        this.worldWorldOctree = new WorkerOctree(subTree);
        this.buildComplete = true;
        call && call();
    }

    /**
     * 使用webWorker进行八叉树构建、检测
     */
    useWebWorker() {
        /** 构建八叉树的web worker */
        const worker = new Worker(
            new URL("../worker/OctreeBuild.ts", import.meta.url)
        );
        this.worker = worker;
        worker.onmessage = (e) => {
            if (e.data.type === "graphNodeBuildComplete") {
                console.log("八叉树构建完成", e.data);
                this.builded && this.builded();
                // requestAnimationFrame(() => {
                this.buildComplete = true;
                // });
            } else if (e.data.type == "colliderResult") {
                if (e.data.result) {
                    const { normal } = e.data.result;
                    this.resultNormal.copy(normal);
                    e.data.result.normal = this.resultNormal;
                }
                this.handleCollider(e.data.result);
                if (this.isLog) {
                    console.log(e.data);
                }
            }
        };
        worker.postMessage({ type: "connect" });

        worker.onerror = (err) => {
            console.error("work出错:", err, err.message);
        };
    }
}

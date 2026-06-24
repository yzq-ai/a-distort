/*
 * @Author: hongbin
 * @Date: 2023-12-01 10:18:55
 * @LastEditors: hongbin
 * @LastEditTime: 2025-01-06 17:09:00
 * @Description: 点击材质装饰器
 */
import { ThreeHelper } from "@/src/ThreeHelper";
import { Raycaster, Vector2 } from "three";
import * as THREE from "three";

export type ListenCallback = (
    mesh?: BackIntersection | MouseEvent,
    info?: BackIntersection,
    event?: MouseEvent
) => void;
export type BackIntersection = THREE.Intersection<
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
> & {
    /** event.clientY 当前鼠标的Y轴坐标 */
    clientY: number;
    /** event.clientX 当前鼠标的X轴坐标 */
    clientX: number;
};

class MyMap<T> {
    private data: Record<string, T> = {};

    getMap(key: string) {
        if (!this.data[key])
            // @ts-ignore
            this.data[key] = new MyMap();
        return this.data[key];
    }

    set(key: string, val: T) {
        this.data[key] = val;
    }

    get(key: string) {
        return this.data[key];
    }

    forEach(call: (key: string, val: T) => void) {
        for (const [key, val] of Object.entries(this.data)) {
            call(key, val);
        }
    }

    delete(key: string) {
        delete this.data[key];
    }

    reset(val: T) {
        this.forEach((k) => {
            this.set(k, val);
        });
    }

    get length() {
        return Object.keys(this.data).length;
    }
}

/**
 * 鼠标事件监听器
 */
class EventMesh {
    private static raycaster = new Raycaster();
    private static pointer = new Vector2();
    private static calls = new MyMap<MyMap<ListenCallback>>();
    private static raycasterMesh: Object3D[];
    private static isInit = new MyMap<boolean>();
    public static absoluteOffsetLeft = 0;
    static RayInfo?: BackIntersection & {};
    /** 记录此次鼠标事件的相关信息 */
    static MouseInfo = {
        /** 从按下鼠标x轴移动的距离 */
        xDistance: 0,
        /** 从按下鼠标y轴移动的距离 */
        yDistance: 0,
    };
    static mouseMoveIntersects = false;

    /** 设置射线检测的对象 */
    static setIntersectObjects(objs: Object3D[]) {
        EventMesh.raycasterMesh = objs;
    }

    static appendIntersectObjects(objs: Object3D[]) {
        EventMesh.raycasterMesh = [...objs, ...(EventMesh.raycasterMesh || [])];
    }

    private static ray(x: number, y: number) {
        const dom = ThreeHelper.instance.renderer.domElement;
        // TODO优化： 窗口变更大小时再更新即可
        const rect = dom.getBoundingClientRect();

        EventMesh.RayInfo = {
            clientX: x,
            clientY: y,
        } as BackIntersection;

        // 约束在 0～1 之间
        EventMesh.pointer.set(
            ((x - rect.left) / rect.width) * 2 - 1,
            -((y - rect.top) / rect.height) * 2 + 1
        );

        EventMesh.raycaster.setFromCamera(
            EventMesh.pointer,
            ThreeHelper.instance.camera
        );

        const intersects = EventMesh.raycaster.intersectObjects(
            EventMesh.raycasterMesh || ThreeHelper.instance.scene.children,
            true
        );

        EventMesh.RayInfo = {
            clientX: x,
            clientY: y,
            ...(intersects[0] ? intersects[0] : {}),
        } as BackIntersection;
    }

    /** 从鼠标按下开始计算x轴y轴移动距离 */
    private static moveDistance(event: MouseEvent) {
        const startX = EventMesh.RayInfo!.clientX;
        const startY = EventMesh.RayInfo!.clientY;

        const { clientX, clientY } = event;
        const xAxisMoveDistance = clientX - startX;
        const yAxisMoveDistance = clientY - startY;
        EventMesh.MouseInfo.xDistance = xAxisMoveDistance;
        EventMesh.MouseInfo.yDistance = yAxisMoveDistance;
    }

    private static mousedown = (event: MouseEvent) => {
        EventMesh.ray(event.clientX, event.clientY);
        EventMesh.calls
            .getMap("mousedown")
            .forEach((_, f) => f(EventMesh.RayInfo, undefined, event));
    };

    private static mousemove = (event: MouseEvent) => {
        if (EventMesh.mouseMoveIntersects) {
            EventMesh.ray(event.clientX, event.clientY);
            EventMesh.moveDistance(event);
            EventMesh.calls
                .getMap("mousemove")
                .forEach((_, f) => f(event, EventMesh.RayInfo, event));
        } else {
            EventMesh.calls.getMap("mousemove").forEach((_, f) => f(event));
        }
    };
    private static mouseup = (event: MouseEvent) => {
        EventMesh.calls.getMap("mouseup").forEach((_, f) => f(event));
    };

    private static addEventListener() {
        console.log("添加鼠标事件监听");
        document.addEventListener("mousedown", EventMesh.mousedown);
    }

    /**
     * 监听OnMouseDown事件 返回鼠标射线检测的结果 (从intersectObjects)
     * @param {result} EventMesh.RayInfo
     * @param {undefined} undefined
     * @param {MouseEvent} event
     */
    static OnMouseDown(root: any) {
        return (
            target: Object,
            propertyKey: string,
            description: PropertyDescriptor
        ) => {
            if (!EventMesh.isInit.get("mousedown")) {
                ThreeHelper.loaded(function () {
                    EventMesh.addEventListener();
                });
            }
            EventMesh.isInit.set("mousedown", true);

            const prev = description.value;

            EventMesh.calls
                .getMap("mousedown")
                .set(propertyKey, (...arg: any[]) =>
                    prev.call(root.instance, ...arg)
                );
        };
    }

    private static _enabledMouseMove = false;

    /**
     * 是否监听鼠标移动事件
     * @default false 关闭
     */
    static get enabledMouseMove() {
        return EventMesh._enabledMouseMove;
    }
    static set enabledMouseMove(v) {
        EventMesh._enabledMouseMove = v;
        if (v) {
            document.addEventListener("mousemove", EventMesh.mousemove);
        } else {
            document.removeEventListener("mousemove", EventMesh.mousemove);
        }
    }

    /**
     * @description: mouseMove时函数执行
     * @param {MouseEvent} event
     * @param {result} EventMesh.RayInfo
     */
    static OnMouseMove(
        root: any,
        /** mousemove时进行射线贯穿 */
        mouseMoveIntersects = false
    ) {
        return (
            target: Object,
            propertyKey: string,
            description: PropertyDescriptor
        ) => {
            const prev = description.value;

            EventMesh.calls
                .getMap("mousemove")
                .set(propertyKey, (...arg: any[]) =>
                    prev.call(root.instance, ...arg)
                );

            if (mouseMoveIntersects) {
                EventMesh.mouseMoveIntersects = true;
            }
        };
    }

    static OnMouseUp(root: any) {
        return (
            target: Object,
            propertyKey: string,
            description: PropertyDescriptor
        ) => {
            // EventMesh.calls.delete(propertyKey);
            // if (!EventMesh.isInit.get("mousedown")) {
            //     ThreeHelper.loaded(function () {
            //         EventMesh.addEventListener();
            //     });
            // }
            // EventMesh.isInit.set("mousedown", true);

            if (!EventMesh.isInit.get("mouseup")) {
                ThreeHelper.loaded(function () {
                    document.addEventListener("mouseup", EventMesh.mouseup);
                });
            }
            EventMesh.isInit.set("mouseup", true);

            const prev = description.value;

            EventMesh.calls
                .getMap("mouseup")
                .set(propertyKey, (...arg: any[]) =>
                    prev.call(root.instance, ...arg)
                );
        };
    }

    static destroy() {
        console.log("移除监听");
        EventMesh.isInit.reset(false);

        // removeEventListener
        document.removeEventListener("mousedown", EventMesh.mousedown);
        document.removeEventListener("mouseup", EventMesh.mouseup);
    }
}

export default EventMesh;

/*
 * @Author: hongbin
 * @Date: 2023-02-06 10:15:47
 * @LastEditors: hongbin
 * @LastEditTime: 2023-05-09 15:07:01
 * @Description: 拓展THREE的八叉树
 */
import { Box3, Line3, Plane, Sphere, Triangle, Vector3 } from "three";
import { Capsule } from "./Capsule";

const _v1 = new Vector3();
const _v2 = new Vector3();
const _plane = new Plane();
const _line1 = new Line3();
const _line2 = new Line3();
const _sphere = new Sphere();
const _capsule = new Capsule();
const _box = new Box3();
const _vector3 = new Vector3();
const _boxSize = new Vector3();

type TResult =
    | {
          normal: Vector3;
          depth: number;
          mesh?: Mesh;
          meshName?: string;
      }
    | boolean;

class Octree {
    triangles: Triangle[];
    box!: Box3;
    subTrees: Octree[];
    bounds!: Box3;

    constructor(box?: Box3) {
        this.triangles = [];
        this.box = box!;
        this.subTrees = [];
    }

    addTriangle(triangle: Triangle) {
        if (!this.bounds) this.bounds = new Box3();

        this.bounds.min.x = Math.min(
            this.bounds.min.x,
            triangle.a.x,
            triangle.b.x,
            triangle.c.x
        );
        this.bounds.min.y = Math.min(
            this.bounds.min.y,
            triangle.a.y,
            triangle.b.y,
            triangle.c.y
        );
        this.bounds.min.z = Math.min(
            this.bounds.min.z,
            triangle.a.z,
            triangle.b.z,
            triangle.c.z
        );
        this.bounds.max.x = Math.max(
            this.bounds.max.x,
            triangle.a.x,
            triangle.b.x,
            triangle.c.x
        );
        this.bounds.max.y = Math.max(
            this.bounds.max.y,
            triangle.a.y,
            triangle.b.y,
            triangle.c.y
        );
        this.bounds.max.z = Math.max(
            this.bounds.max.z,
            triangle.a.z,
            triangle.b.z,
            triangle.c.z
        );

        this.triangles.push(triangle);

        return this;
    }

    calcBox() {
        this.box = this.bounds.clone();

        // offset small amount to account for regular grid
        this.box.min.x -= 0.01;
        this.box.min.y -= 0.01;
        this.box.min.z -= 0.01;

        return this;
    }

    split(level: number) {
        const subTrees = [];
        const halfsize = _v2
            .copy(this.box.max)
            .sub(this.box.min)
            .multiplyScalar(0.5);

        for (let x = 0; x < 2; x++) {
            for (let y = 0; y < 2; y++) {
                for (let z = 0; z < 2; z++) {
                    const box = new Box3();
                    const v = _v1.set(x, y, z);

                    box.min.copy(this.box.min).add(v.multiply(halfsize));
                    box.max.copy(box.min).add(halfsize);

                    subTrees.push(new Octree(box));
                }
            }
        }

        let triangle;

        while ((triangle = this.triangles.pop())) {
            for (let i = 0; i < subTrees.length; i++) {
                if (subTrees[i].box.intersectsTriangle(triangle)) {
                    subTrees[i].triangles.push(triangle);
                }
            }
        }

        for (let i = 0; i < subTrees.length; i++) {
            const len = subTrees[i].triangles.length;

            if (len > 8 && level < 16) {
                subTrees[i].split(level + 1);
            }

            if (len !== 0) {
                this.subTrees.push(subTrees[i]);
            }
        }

        return this;
    }

    build() {
        this.calcBox();
        this.split(0);

        return this;
    }

    getRayTriangles(
        ray: { intersectsBox: (arg0: any) => any },
        triangles: any[]
    ) {
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];
            if (!ray.intersectsBox(subTree.box)) continue;

            if (subTree.triangles.length > 0) {
                for (let j = 0; j < subTree.triangles.length; j++) {
                    if (triangles.indexOf(subTree.triangles[j]) === -1)
                        triangles.push(subTree.triangles[j]);
                }
            } else {
                subTree.getRayTriangles(ray, triangles);
            }
        }

        return triangles;
    }

    triangleCapsuleIntersect(capsule: Capsule, triangle: Triangle) {
        // triangle.getPlane(_plane);
        // 使用这种方法 使worker传递的结构化数据也可正常参与运算
        setFromCoplanarPoints(triangle.a, triangle.b, triangle.c);

        const d1 = _plane.distanceToPoint(capsule.start) - capsule.radius;
        const d2 = _plane.distanceToPoint(capsule.end) - capsule.radius;

        if (
            (d1 > 0 && d2 > 0) ||
            (d1 < -capsule.radius && d2 < -capsule.radius)
        ) {
            return false;
        }

        const delta = Math.abs(d1 / (Math.abs(d1) + Math.abs(d2)));
        const intersectPoint = _v1.copy(capsule.start).lerp(capsule.end, delta);

        // if (triangle.containsPoint(intersectPoint)) {
        if (
            TriangleContainsPoint(
                intersectPoint,
                triangle.a,
                triangle.b,
                triangle.c
            )
        ) {
            return {
                normal: _plane.normal.clone(),
                point: intersectPoint.clone(),
                depth: Math.abs(Math.min(d1, d2)),
                mesh: triangle.mesh,
                meshName: triangle.mesh.name,
            };
        }

        const r2 = capsule.radius * capsule.radius;

        const line1 = _line1.set(capsule.start, capsule.end);

        const lines = [
            [triangle.a, triangle.b],
            [triangle.b, triangle.c],
            [triangle.c, triangle.a],
        ];

        for (let i = 0; i < lines.length; i++) {
            const line2 = _line2.set(lines[i][0], lines[i][1]);

            const [point1, point2] = capsule.lineLineMinimumPoints(
                line1,
                line2
            );

            if (point1.distanceToSquared(point2) < r2) {
                return {
                    normal: point1.clone().sub(point2).normalize(),
                    point: point2.clone(),
                    depth: capsule.radius - point1.distanceTo(point2),
                    mesh: triangle.mesh,
                    meshName: triangle.mesh.name,
                };
            }
        }

        return false;
    }

    triangleBoxIntersect(box: Box3, triangle: Triangle, box3: Box3) {
        // if (box3.intersectsBox(box)) {
        //     return { normal: triangle.getNormal(_vector3).clone() };
        // }
        // 根据八叉树筛选出来的附近的点 构成的三角形面
        // triangle.getPlane(_plane);
        //通过盒子的点进行计算是否碰撞/穿透
        // return _plane.intersectsBox(box);

        // _boxSize
        //上面4个点
        // const rightBottom = box.max;
        // const rightTop = rightBottom.clone();
        // rightTop.z -= _boxSize.z;
        // const leftTop = rightTop.clone();
        // leftTop.x -= _boxSize.x;
        // const leftBottom = rightBottom.clone();
        // leftBottom.x -= _boxSize.x;

        // const l = new Line3(box.max, box.min);
        if (triangle.intersectsBox(box) && box3.intersectsBox(box)) {
            return { normal: triangle.getNormal(_vector3).clone() };
        }

        return false;
    }

    triangleSphereIntersect(
        sphere: Sphere,
        triangle: {
            getPlane: (arg0: Plane) => void;
            containsPoint: (arg0: any) => any;
            a: any;
            b: any;
            c: any;
        }
    ) {
        triangle.getPlane(_plane);

        if (!sphere.intersectsPlane(_plane)) return false;

        const depth = Math.abs(_plane.distanceToSphere(sphere));
        const r2 = sphere.radius * sphere.radius - depth * depth;

        const plainPoint = _plane.projectPoint(sphere.center, _v1);

        if (triangle.containsPoint(sphere.center)) {
            return {
                normal: _plane.normal.clone(),
                point: plainPoint.clone(),
                depth: Math.abs(_plane.distanceToSphere(sphere)),
            };
        }

        const lines = [
            [triangle.a, triangle.b],
            [triangle.b, triangle.c],
            [triangle.c, triangle.a],
        ];

        for (let i = 0; i < lines.length; i++) {
            _line1.set(lines[i][0], lines[i][1]);
            _line1.closestPointToPoint(plainPoint, true, _v2);

            const d = _v2.distanceToSquared(sphere.center);

            if (d < r2) {
                return {
                    normal: sphere.center.clone().sub(_v2).normalize(),
                    point: _v2.clone(),
                    depth: sphere.radius - Math.sqrt(d),
                };
            }
        }

        return false;
    }

    getSphereTriangles(
        sphere: { intersectsBox: (arg0: any) => any },
        triangles: Triangle[]
    ) {
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];

            if (!sphere.intersectsBox(subTree.box)) continue;

            if (subTree.triangles.length > 0) {
                for (let j = 0; j < subTree.triangles.length; j++) {
                    if (triangles.indexOf(subTree.triangles[j]) === -1)
                        triangles.push(subTree.triangles[j]);
                }
            } else {
                subTree.getSphereTriangles(sphere, triangles);
            }
        }
    }

    getCapsuleTriangles(capsule: Capsule, triangles: THREE.Triangle[]) {
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];

            if (!capsule.intersectsBox(subTree.box)) continue;

            if (subTree.triangles.length > 0) {
                for (let j = 0; j < subTree.triangles.length; j++) {
                    if (triangles.indexOf(subTree.triangles[j]) === -1)
                        triangles.push(subTree.triangles[j]);
                }
            } else {
                subTree.getCapsuleTriangles(capsule, triangles);
            }
        }
    }
    //TODO 将盒子模型添加 直接盒子之间计算
    getBoxTriangles(Box: Box3, triangles: any[], boxes: Box3[]) {
        for (let i = 0; i < this.subTrees.length; i++) {
            const subTree = this.subTrees[i];

            if (!Box.intersectsBox(subTree.box)) continue;

            if (subTree.triangles.length > 0) {
                for (let j = 0; j < subTree.triangles.length; j++) {
                    if (triangles.indexOf(subTree.triangles[j]) === -1) {
                        triangles.push(subTree.triangles[j]);
                        boxes.push(subTree.box);
                    }
                }
            } else {
                subTree.getBoxTriangles(Box, triangles, boxes);
            }
        }
    }

    sphereIntersect(sphere: Sphere) {
        _sphere.copy(sphere);

        const triangles: string | any[] = [];
        let result: TResult,
            hit = false;

        this.getSphereTriangles(sphere, triangles);

        for (let i = 0; i < triangles.length; i++) {
            if (
                (result = this.triangleSphereIntersect(_sphere, triangles[i]))
            ) {
                hit = true;

                _sphere.center.add(result.normal.multiplyScalar(result.depth));
            }
        }

        if (hit) {
            const collisionVector = _sphere.center.clone().sub(sphere.center);
            const depth = collisionVector.length();

            return { normal: collisionVector.normalize(), depth: depth };
        }

        return false;
    }

    /**
     * 胶囊体穿透
     * 增加第二个参数 可用于单独某物体与胶囊体碰撞检测
     */
    capsuleIntersect(
        capsule: Capsule,
        otherTriangles = [] as THREE.Triangle[]
    ) {
        _capsule.copy(capsule);
        let result: TResult,
            meshNames = [] as Array<string | undefined>,
            meshName,
            meshuuid,
            hit = false;
        const triangles: THREE.Triangle[] = [...otherTriangles];
        this.getCapsuleTriangles(_capsule, triangles);

        for (let i = 0; i < triangles.length; i++) {
            // 不能碰到障碍就返回 因为与可能与多个物体面碰撞
            if (
                (result = this.triangleCapsuleIntersect(_capsule, triangles[i]))
            ) {
                hit = true;
                meshuuid = result.mesh!.uuid;
                meshName = result.meshName;
                meshNames.push(meshName);
                _capsule.translate(result.normal.multiplyScalar(result.depth));
            }
        }

        if (hit) {
            const collisionVector = _capsule
                .getCenter(new Vector3())
                .sub(capsule.getCenter(_v1));
            const depth = collisionVector.length();

            return {
                normal: collisionVector.normalize(),
                depth: depth,
                // mesh,
                meshName,
                meshuuid,
                meshNames,
            };
        }

        return false;
    }

    rayIntersect(ray: any) {
        if (ray.direction.length() === 0) return;

        const triangles: string | any[] = [];
        let triangle,
            position,
            distance = 1e100;

        this.getRayTriangles(ray, triangles);

        for (let i = 0; i < triangles.length; i++) {
            const result = ray.intersectTriangle(
                triangles[i].a,
                triangles[i].b,
                triangles[i].c,
                true,
                _v1
            );

            if (result) {
                const newdistance = result.sub(ray.origin).length();

                if (distance > newdistance) {
                    position = result.clone().add(ray.origin);
                    distance = newdistance;
                    triangle = triangles[i];
                }
            }
        }

        return distance < 1e100
            ? { distance: distance, triangle: triangle, position: position }
            : false;
    }

    boxCollider(box: Box3, subTrees: Octree[]) {
        for (let i = 0; i < subTrees.length; i++) {
            const subTree = subTrees[i];

            if (!box.intersectsBox(subTree.box)) continue;

            if (subTree.subTrees.length > 0) {
                this.boxCollider(box, subTree.subTrees);
            } else {
                // return subTree.box.distanceToPoint(box.getCenter(_vector3));
                // return true;
            }
        }
    }

    /**
     * TODO 添加box3检测 目前不灵敏
     */
    boxIntersect(Box: Box3) {
        _box.copy(Box);

        const triangles: Triangle[] = [];
        const boxes: Box3[] = [];

        this.getBoxTriangles(Box, triangles, boxes);

        // Box.getSize(_boxSize);

        //@ts-ignore
        if (window.log) {
            console.log(triangles, boxes);
        }
        for (let i = 0; i < triangles.length; i++) {
            return this.triangleBoxIntersect(Box, triangles[i], boxes[i]);
        }

        return false;
    }

    fromGraphNode(group: Object3D) {
        group.updateWorldMatrix(true, true);

        group.traverse((item) => {
            const obj = item as THREE.Mesh;
            if (obj.isMesh === true && !obj.userData.filter) {
                let geometry,
                    isTemp = false;
                const triangleList = [] as THREE.Triangle[];
                if (obj.geometry.index !== null) {
                    isTemp = true;
                    geometry = obj.geometry.toNonIndexed();
                } else {
                    geometry = obj.geometry;
                }
                const positionAttribute = geometry.getAttribute("position");

                for (let i = 0; i < positionAttribute.count; i += 3) {
                    const triangle = composeTriangles(
                        obj,
                        positionAttribute,
                        i
                    );
                    this.addTriangle(triangle);
                    triangleList.push(triangle);
                }

                if (isTemp) {
                    geometry.dispose();
                }
            }
        });

        this.build();

        return this;
    }
}

export { Octree };

/**
 * 构成三角面
 */
function composeTriangles(mesh: Mesh, positionAttribute: any, i: number) {
    const v1 = new Vector3().fromBufferAttribute(positionAttribute, i);
    const v2 = new Vector3().fromBufferAttribute(positionAttribute, i + 1);
    const v3 = new Vector3().fromBufferAttribute(positionAttribute, i + 2);

    v1.applyMatrix4(mesh.matrixWorld);
    v2.applyMatrix4(mesh.matrixWorld);
    v3.applyMatrix4(mesh.matrixWorld);
    const triangle = new Triangle(v1, v2, v3);
    triangle.mesh = mesh;
    triangle.name = mesh.name;
    return triangle;
}

/**
 * 获取物体的面
 */
export function getMeshTriangles(mesh: Mesh) {
    let geometry,
        isTemp = false;
    if (mesh.geometry.index !== null) {
        isTemp = true;
        geometry = mesh.geometry.toNonIndexed();
    } else {
        geometry = mesh.geometry;
    }

    const triangles = [] as {
        a: THREE.Vector3;
        b: THREE.Vector3;
        c: THREE.Vector3;
        /** 八叉树返回碰撞物体使用 */
        mesh: { name: string };
    }[];

    const positionAttribute = geometry.getAttribute("position");

    // 至关重要 否则无法应用变化的面的位置
    mesh.updateWorldMatrix(true, true);

    for (let i = 0; i < positionAttribute.count; i += 3) {
        const { a, b, c } = composeTriangles(mesh, positionAttribute, i);
        triangles.push({ a, b, c, mesh: { name: mesh.name } });
    }
    //!如果挂载到userData上 转换成webWorker结构化数据时要另外解析
    // mesh.userData.triangles = triangles;

    const translate = (v: { x: number; y: number; z: number }) => {
        mesh.position.add(v as Vector3);
        triangles.forEach((triangle) => {
            triangle.a.add(v as Vector3);
            triangle.b.add(v as Vector3);
            triangle.c.add(v as Vector3);
        });
    };
    if (isTemp) {
        geometry.dispose();
    }
    return { triangles, translate };
}

const _getTriangleV0 = new Vector3();
const _getTriangleV1 = new Vector3();
const _getTriangleV2 = new Vector3();
const _getTriangleV3 = new Vector3();

/**
 * Triangle.containsPoint 为了不进行三角面转换 减小开销 将原方法提取
 */
function TriangleContainsPoint(
    point: Vector3,
    a: Vector3,
    b: Vector3,
    c: Vector3
) {
    getBarycoord(point, a, b, c, _getTriangleV3);

    return (
        _getTriangleV3.x >= 0 &&
        _getTriangleV3.y >= 0 &&
        _getTriangleV3.x + _getTriangleV3.y <= 1
    );
}

/**
 * Triangle 中的 getBarycoord  方法用来计算点是否在面中
 * static/instance method to calculate barycentric coordinates
 * based on: http://www.blackpawn.com/texts/pointinpoly/default.html
 */
function getBarycoord(
    point: Vector3,
    a: Vector3,
    b: Vector3,
    c: Vector3,
    target: Vector3
) {
    _getTriangleV0.subVectors(c, a);
    _getTriangleV1.subVectors(b, a);
    _getTriangleV2.subVectors(point, a);

    const dot00 = dot(_getTriangleV0, _getTriangleV0);
    const dot01 = dot(_getTriangleV0, _getTriangleV1);
    const dot02 = dot(_getTriangleV0, _getTriangleV2);
    const dot11 = dot(_getTriangleV1, _getTriangleV1);
    const dot12 = dot(_getTriangleV1, _getTriangleV2);

    const denom = dot00 * dot11 - dot01 * dot01;

    // collinear or singular triangle
    if (denom === 0) {
        // arbitrary location outside of triangle?
        // not sure if this is the best idea, maybe should be returning undefined
        return target.set(-2, -1, -1);
    }

    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;

    // barycentric coordinates must always sum to 1
    return target.set(1 - u - v, v, u);
}

const _getPlaneV1 = new Vector3();
const _getPlaneV2 = new Vector3();

/**
 * Vector3 的dot方法
 */
function dot(
    v1: { x: number; y: number; z: number },
    v2: { x: number; y: number; z: number }
) {
    return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
}

function setFromCoplanarPoints(a: Vector3, b: Vector3, c: Vector3) {
    const normal = _getPlaneV1
        .subVectors(c, b)
        .cross(_getPlaneV2.subVectors(a, b))
        .normalize();
    setFromNormalAndCoplanarPoint(normal, a);
}

function setFromNormalAndCoplanarPoint(
    normal: Vector3,
    point: { x: number; y: number; z: number }
) {
    _plane.normal.copy(normal);
    _plane.constant = -dot(point, _plane.normal);
}

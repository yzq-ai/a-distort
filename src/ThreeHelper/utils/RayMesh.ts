/*
 * @Author: hongbin
 * @Date: 2024-06-27 15:32:48
 * @LastEditors: hongbin
 * @LastEditTime: 2024-06-27 16:00:22
 * @Description:
 */
import * as THREE from "three";

const _ray = new THREE.Ray();
const _inverseMatrix = new THREE.Matrix4();

export class RayMesh extends THREE.Mesh {
    /**
     * 拦截Mesh的raycast方法 不检测 boundingSphere 配合SkinnedMesh转换的Mesh的射线使用
     */
    constructor(...arg: any[]) {
        super(...arg);
    }

    raycast(raycaster: THREE.Raycaster, intersects: any) {
        const geometry = this.geometry;
        const material = this.material;
        const matrixWorld = this.matrixWorld;

        if (material === undefined) return;

        _ray.copy(raycaster.ray).recast(raycaster.near);
        _inverseMatrix.copy(matrixWorld).invert();
        _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);

        // test with bounding box in local space

        if (geometry.boundingBox !== null) {
            if (_ray.intersectsBox(geometry.boundingBox) === false) return;
        }

        // test for intersections with geometry

        super._computeIntersections(raycaster, intersects, _ray);
    }
}

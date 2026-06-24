/*
 * @Author: hongbin
 * @Date: 2023-08-27 17:45:43
 * @LastEditors: hongbin
 * @LastEditTime: 2025-01-07 12:26:25
 * @Description: 便捷创建mesh
 */
import * as THREE from "three";
import { ThreeHelper } from "..";

export class Create {
    private static defaultMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#51f"),
    }) as THREE.Material;

    private static _temp: {
        mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
        material: (material: THREE.Material) => void;
    };

    private static callbackTemp<
        T extends THREE.BufferGeometry,
        M extends THREE.Material | THREE.Material[] = THREE.Material
    >() {
        return {
            mesh: Create._temp.mesh as THREE.Mesh<T, M>,
            material: Create._temp.material,
            add: function () {
                if (ThreeHelper.instance.scene) {
                    ThreeHelper.instance.scene.add(Create._temp.mesh);
                }
                return this;
            },
        };
    }

    @Create.geometry(THREE.PlaneGeometry)
    static plane<T extends THREE.Material>(
        ...args: ConstructorParameters<typeof THREE.PlaneGeometry>
    ) {
        return Create.callbackTemp<THREE.PlaneGeometry, T>();
    }

    @Create.geometry(THREE.TorusKnotGeometry)
    static torusKnot(
        ...args: ConstructorParameters<typeof THREE.TorusKnotGeometry>
    ) {
        return Create.callbackTemp<THREE.TorusKnotGeometry>();
    }

    @Create.geometry(THREE.BoxGeometry)
    static box<T extends THREE.Material>(
        ...args: ConstructorParameters<typeof THREE.BoxGeometry>
    ) {
        return Create.callbackTemp<THREE.BoxGeometry, T>();
    }

    @Create.geometry(THREE.SphereGeometry)
    static sphere<T extends THREE.Material>(
        ...args: ConstructorParameters<typeof THREE.SphereGeometry>
    ) {
        return Create.callbackTemp<THREE.SphereGeometry, T>();
    }

    @Create.geometry(THREE.CylinderGeometry)
    static cylinder(
        ...args: ConstructorParameters<typeof THREE.CylinderGeometry>
    ) {
        return Create.callbackTemp<THREE.CylinderGeometry>();
    }

    @Create.geometry(THREE.DodecahedronGeometry)
    static dodecahedronGeometry(
        ...args: ConstructorParameters<typeof THREE.DodecahedronGeometry>
    ) {
        return Create.callbackTemp<THREE.DodecahedronGeometry>();
    }

    /**
     * 几何体装饰器
     * 返回mesh和修改material的方法，以后可以拓充更多方法
     */
    private static geometry = <
        T extends new (...args: any) => any = typeof THREE.BufferGeometry
    >(
        geometry: T
    ): MethodDecorator => {
        return function (t, k, d) {
            const prev = <typeof Create.plane>d.value;
            (d.value as any) = (...args: ConstructorParameters<T>) => {
                // @ts-ignore
                Create.handleGeometry(geometry, ...args);
                return prev.call(Create);
            };
        };
    };

    /**
     * geometry装饰器 内部的实现
     */
    private static handleGeometry = (
        geometry: typeof THREE.BufferGeometry,
        ...args: ConstructorParameters<typeof geometry>
    ) => {
        const geo = new geometry(...args);
        const mesh = new THREE.Mesh(geo, Create.defaultMaterial);
        Create._temp = {
            mesh,
            material: (material: THREE.Material) => {
                mesh.material = material;
            },
        };
    };
}

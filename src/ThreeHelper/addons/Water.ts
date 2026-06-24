/*
 * @Author: hongbin
 * @Date: 2023-04-03 16:42:19
 * @LastEditors: hongbin
 * @LastEditTime: 2023-08-24 19:34:56
 * @Description: 水
 */
import { RepeatWrapping, TextureLoader, Vector3 } from "three";
import { Water as THREEWater } from "three/examples/jsm/objects/Water";

export class Water {
    sunDirection: (position: THREE.Vector3) => this;

    constructor(waterMath: Mesh, size = 3) {
        const water = new THREEWater(waterMath.geometry, {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new TextureLoader().load(
                "/textures/waternormals.jpg",
                function (texture) {
                    texture.wrapS = texture.wrapT = RepeatWrapping;
                }
            ),
            sunDirection: new Vector3(),
            sunColor: 0xffffff,
            waterColor: "#5511ff",
            distortionScale: 3.7,
        });
        water.material.uniforms["sunDirection"].value.copy(water.position);
        water.material.uniforms["sunDirection"].value.y += 1;
        water.material.uniforms["size"].value = size;

        water.onAfterRender = () => {
            water.material.uniforms["time"].value += 0.0016;
        };

        waterMath.add(water);

        this.sunDirection = (position: THREE.Vector3) => {
            water.material.uniforms["sunDirection"].value.copy(position);
            return this;
        };
    }
}

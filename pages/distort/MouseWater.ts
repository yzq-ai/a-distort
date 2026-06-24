import { ThreeHelper } from "@/src/ThreeHelper";
import * as THREE from "three";

export class MouseWater {
    count = 100;
    scene = new THREE.Scene();
    mouse = new THREE.Vector2();
    prevMouse = new THREE.Vector2();
    curr = -1;
    brushes: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];

    constructor() {
        this.init();
    }

    init() {
        const geometry = new THREE.PlaneGeometry(64, 64);

        for (let i = 0; i < this.count; i++) {
            const material = new BaseMaterial({
                map: ThreeHelper.instance.loadTexture("/public/textures/brush01.png"),
            });

            const mesh = new THREE.Mesh(geometry, material);

            mesh.visible = false;

            this.scene.add(mesh);
            this.brushes.push(mesh);
        }

        document.addEventListener("mousemove", (e) => {
            this.mouse.set(e.clientX, innerHeight - e.clientY);
            
            if (Math.abs(this.prevMouse.x - this.mouse.x) > 4 && Math.abs(this.prevMouse.y - this.mouse.y) > 4) {
                this.curr = (this.curr + 1) % this.count;
                this.setNewWave();
                this.prevMouse.copy(this.mouse);
            }

        });
    }

    setNewWave() {
        const mesh = this.brushes[this.curr];

        if (mesh) {
            mesh.visible = true;

            const halfWidth = innerWidth / 2;
            const halfHeight = innerHeight / 2;

            mesh.position.x = (this.mouse.x - halfWidth) / 2;
            mesh.position.y = (this.mouse.y - halfHeight) / 2;

            mesh.scale.x = 0.1;
            mesh.scale.y = 0.1;

            mesh.material.uniforms.opacity.value = 1;
        } else {
            console.warn(this.curr);
        }
    }

    onRender() {
        this.brushes.forEach((mesh, index) => {
            mesh.rotation.z += 0.02;
            mesh.scale.x = 0.98 * mesh.scale.x + 0.1;
            mesh.scale.y = mesh.scale.x;

            mesh.material.uniforms.opacity.value *= 0.96;

            if (mesh.material.uniforms.opacity.value < 0.002) {
                mesh.visible = false;
            }
        });
    }
}

class BaseMaterial extends THREE.ShaderMaterial {
    constructor(params: { map: THREE.Texture }) {
        super({
            uniforms: {
                map: { value: params.map },
                opacity: { value: 0 },
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                
                void main() {
                    vUv = uv;

                    vec4 transformed = vec4(position, 1.0);

                    vec4 modelPosition = modelViewMatrix * transformed;

                    gl_Position = projectionMatrix * modelPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec2 vUv;
                uniform sampler2D map;
                uniform float opacity;

                void main() {
                   
                    vec4 color = texture2D(map,vUv);

                    color.a *= opacity;
                    
                    gl_FragColor = vec4(color); 
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
        });
    }
}

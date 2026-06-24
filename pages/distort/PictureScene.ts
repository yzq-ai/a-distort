import { ThreeHelper } from "@/src/ThreeHelper";
import { gsap } from "gsap";
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export class PictureScene {
    public scene = new THREE.Scene();
    public renderTarget!: THREE.WebGLRenderTarget<THREE.Texture>;
    private size = new THREE.Vector2();
    private planeList: THREE.Mesh[] = [];
    groupList: THREE.Group[] = [];
    private layoutType = -1;
    layoutSize: { x: number; y: number; z: number }[][] = [];
    rotationFactor = { value: 1 };
    labelRenderer?: CSS2DRenderer;

    constructor() {
        this.initCss2D();
        this.init();
    }

    init() {
        const helper = ThreeHelper.instance;

        helper.controls.enableZoom = false;

        const pixelRatio = helper.renderer.getPixelRatio();

        helper.renderer.getSize(this.size).multiplyScalar(pixelRatio);

        const renderTarget = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter,
            wrapS: THREE.RepeatWrapping,
            wrapT: THREE.RepeatWrapping,
        });

        this.renderTarget = renderTarget;

        helper.gui?.add(this.rotationFactor, "value", 0, 1).name("旋转影响系数");

        this.addProjectTitle();

        this.addPlane();

        this.previewLoadLayout();

        this.start();
        // this.onResize();

        helper.addResizeListen(() => this.onResize());
    }

    addProjectTitle() {
        const helper = ThreeHelper.instance;

        const plane = helper.create.plane(8, 4);

        this.scene.add(plane.mesh);

        plane.mesh.position.set(0, 2, -1);

        plane.material(
            new THREE.MeshBasicMaterial({
                map: helper.loadTexture("/public/textures/projects.png", (t) => (t.colorSpace = THREE.SRGBColorSpace)),
                transparent: true,
                opacity: 0,
            })
        );

        const ScrollElement = document.querySelector("#ScrollElement");

        if (!ScrollElement) throw new Error("ScrollElement not found");

        const projectsOpacity = (opacity: 0 | 1) => {
            if (this.labelRenderer) {
                gsap.killTweensOf(plane.mesh.material);

                gsap.fromTo(
                    plane.mesh.material,
                    { opacity: 1 - opacity },
                    {
                        opacity: opacity,
                        duration: opacity == 1 ? 1 : 0.2,
                        ease: "power3",
                    }
                );
            }
        };

        gsap.to(
            {},
            {
                scrollTrigger: {
                    trigger: ScrollElement,
                    start: innerHeight / 2,
                    end: innerHeight + 50,
                    scrub: true,
                    onEnterBack: () => {
                        projectsOpacity(0);
                    },
                    onLeave: () => {
                        projectsOpacity(1);
                    },
                },
            }
        );
    }

    addPlane() {
        const geometry = new THREE.PlaneGeometry(16, 9);

        this.loadTextures().forEach(({ map, title }, index) => {
            const material = new BaseMaterial({
                map,
                rotationFactor: this.rotationFactor,
            });

            const plane = new THREE.Mesh(geometry, material);
            const group = new THREE.Group();

            // 创建 DOM 元素
            const wrap = document.createElement("div");

            wrap.onclick = () => {
                const tempIMG = document.getElementById("tempIMG") as HTMLImageElement;

                tempIMG.src = map.image.src;

                tempIMG.parentElement!.style.left = "0";

                console.log(map.image.src);
            };

            wrap.style.width = "380px";
            wrap.style.height = "220px";
            wrap.style.position = "relative";
            wrap.style.color = "#fffae5";
            wrap.style.cursor = 'pointer';

            const indexDom = document.createElement("h1");
            indexDom.innerHTML = "" + (index + 1);
            indexDom.style.position = "absolute";
            indexDom.style.top = "-1.5rem";

            const symbolDom = document.createElement("h1");
            symbolDom.innerHTML = "#";
            symbolDom.style.position = "absolute";
            symbolDom.style.top = "-1rem";
            symbolDom.style.left = "-1rem";
            symbolDom.style.fontSize = "20px";

            wrap.appendChild(symbolDom);
            wrap.appendChild(indexDom);

            const titleDom = document.createElement("strong");
            titleDom.innerHTML = title;
            titleDom.style.position = "absolute";
            titleDom.style.bottom = "-1.5vw";

            wrap.appendChild(titleDom);

            const earthLabel = new CSS2DObject(wrap);
            group.add(earthLabel);

            plane.userData.random = Math.random() * 2 - 1;

            group.add(plane);
            this.scene.add(group);

            this.planeList.push(plane);
            this.groupList.push(group);
        });
    }

    css2DElementOpacity(opacity: 0 | 1) {
        if (this.labelRenderer) {
            gsap.killTweensOf(this.labelRenderer.domElement.style);

            gsap.fromTo(
                this.labelRenderer.domElement.style,
                { opacity: 1 - opacity },
                {
                    opacity: opacity,
                    duration: opacity == 1 ? 1 : 0.3,
                    ease: "power3",
                }
            );
        }
    }

    initCss2D() {
        this.labelRenderer = new CSS2DRenderer();

        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);

        this.labelRenderer.domElement.style.position = "fixed";
        this.labelRenderer.domElement.style.top = "0px";
        this.labelRenderer.domElement.style.left = "0px";
        this.labelRenderer.domElement.style.opacity = "0";

        document.body.appendChild(this.labelRenderer.domElement);

        const helper = ThreeHelper.instance;

        helper.addResizeListen(() => {
            this.labelRenderer && this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    loadTextures() {
        const helper = ThreeHelper.instance;

        const setColorSpace = (t: THREE.Texture) => {
            t.colorSpace = THREE.SRGBColorSpace;
        };

        return [
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-gpe9ql_1280x720.png", setColorSpace),
                title: "尼禄",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-gpvdee_1280x720.png", setColorSpace),
                title: "申鹤",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-jxomzw_1280x720.png", setColorSpace),
                title: "芙宁娜-幼",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-m3m1yk_1280x720.png", setColorSpace),
                title: "登陆界面",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-jxjjvw_1280x720.png", setColorSpace),
                title: "克洛琳德",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-vqjkpl_1280x720.png", setColorSpace),
                title: "山景",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-3l88kv_1280x720.png", setColorSpace),
                title: "雷电将军",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-vqr7g5_1280x720.png", setColorSpace),
                title: "芙宁娜",
            },
            {
                map: helper.loadTexture("/public/textures/原神/wallhaven-wqwj5r_1280x720.png", setColorSpace),
                title: "巴巴托斯 钟离 影 荧",
            },
            { map: helper.loadTexture("/public/env/sky/nx.png", setColorSpace), title: "env/sky/nx.png" },
            { map: helper.loadTexture("/public/env/sky/px.png", setColorSpace), title: "env/sky/px.png" },
            { map: helper.loadTexture("/public/env/sky/ny.png", setColorSpace), title: "env/sky/ny.png" },
            { map: helper.loadTexture("/public/env/sky/py.png", setColorSpace), title: "env/sky/py.png" },
            { map: helper.loadTexture("/public/env/sky/nz.png", setColorSpace), title: "env/sky/nz.png" },
            { map: helper.loadTexture("/public/env/sky/pz.png", setColorSpace), title: "env/sky/pz.png" },
        ];
    }

    start() {
        // gsap
        this.groupList.forEach((group, index) => {
            group.position.set(index + 20, -25, index * 0.5);

            this.layoutSize[3].push({ x: index + 20, y: -25, z: index * 0.5 });

            window.scrollTo({ left: 0, top: 0 });
        });

        this.scene.position.y = -10;

        gsap.fromTo(
            // gsap.to(
            this.scene.position,
            {
                y: -10,
            },
            {
                duration: 1,
                y: 0,
                ease: "power1",
                onComplete: () => {
                    const ScrollElement = document.querySelector("#ScrollElement") as HTMLDivElement;

                    if (ScrollElement) {
                        ScrollElement.style["height"] = "600vh";
                    }
                },
            }
        );
    }

    render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
        this.planeList.forEach((plane) => {
            plane.rotation.z += plane.userData.random * 0.01;
        });

        renderer.setRenderTarget(this.renderTarget);

        renderer.render(this.scene, camera);
    }

    /** 获取当前的位置 */
    get layout() {
        return this.layoutSize[this.getShouldLayoutType(true)];
    }

    /** 获取初始的位置 */
    get originalLayout() {
        return this.layoutSize[3];
    }

    /** 提前加载三种布局位置 */
    previewLoadLayout() {
        const layoutSize: { x: number; y: number; z: number }[][] = [[], [], [], []];

        this.groupList.forEach((group, index) => {
            layoutSize[0].push({
                x: 20 * Math.floor(index % 3) - 20,
                y: Math.floor(index / 3) * -20 - 10 ,
                z: 8,
            });

            layoutSize[1].push({
                x: 20 * Math.floor(index % 2) - 10,
                y: Math.floor(index / 2) * -20 - 10 ,
                z: 8,
            });

            layoutSize[2].push({ x: 0, y: index * -15 - 10 , z: 15 });
        });

        this.layoutSize = layoutSize;
    }

    getShouldLayoutType(onlyGet = false) {
        let layoutType;

        if (window.innerWidth > 1300) {
            layoutType = 0;
        } else if (window.innerWidth > 900) {
            layoutType = 1;
        } else {
            layoutType = 2;
        }

        !onlyGet && (this.layoutType = layoutType);

        return layoutType;
    }

    // 画布变窄的时候显示更少更大的图片
    onResize() {
        if (scrollY < innerHeight) {
            // if (innerHeight < 900) {
            //     this.layoutSize[3] = [];
            //     this.groupList.forEach((group, index) => {
            //         group.position.set(index + 10, -25, index * 0.5);
            //         this.layoutSize[3].push({ x: index + 10, y: -25, z: index * 0.5 });
            //     });
            // } else {
            //     this.layoutSize[3] = [];
            //     this.groupList.forEach((group, index) => {
            //         group.position.set(index + 20, -25, index * 0.5);
            //         this.layoutSize[3].push({ x: index + 20, y: -25, z: index * 0.5 });
            //     });
            // }
        } else {
            const prevType = this.layoutType;

            this.getShouldLayoutType();

            const isChange = this.layoutType != prevType;

            // 如果布局改变了 动画调度平面位置 而不是立刻变
            // if (isChange && prevType !== -1) {
            if (isChange) {
                this.groupList.forEach((group, index) => {
                    // group.position.copy(this.layoutSize[this.layoutType][index]);
                    gsap.killTweensOf(group.position);

                    gsap.to(group.position, {
                        ...this.layoutSize[this.layoutType][index],
                        duration: 1,
                        ease: "power3.inOut",
                        // stagger: 0.1,
                    });
                });
            }
        }
    }
}

class BaseMaterial extends THREE.ShaderMaterial {
    constructor(params: { map: THREE.Texture; rotationFactor: { value: number } }) {
        super({
            uniforms: {
                map: { value: params.map },
                rotationFactor: params.rotationFactor,
            },
            vertexShader: /* glsl */ `
                varying vec2 vUv;
                uniform float rotationFactor; 
                uniform float normalized; 

                mat4 adjustRotation(mat4 matrix, float rotationFactor) {
                    // 创建一个新的矩阵以保存结果
                    mat4 result = matrix;
                
                    // 提取缩放因子，保存在对角线位置
                    result[0][0] = length(vec3(matrix[0][0], matrix[1][0], matrix[2][0]));
                    result[1][1] = length(vec3(matrix[0][1], matrix[1][1], matrix[2][1]));
                    result[2][2] = length(vec3(matrix[0][2], matrix[1][2], matrix[2][2]));
                
                    // 控制旋转部分的影响，根据rotationFactor线性插值
                    result[0][1] = matrix[0][1] * rotationFactor;
                    result[0][2] = matrix[0][2] * rotationFactor;
                    result[1][0] = matrix[1][0] * rotationFactor;
                    result[1][2] = matrix[1][2] * rotationFactor;
                    result[2][0] = matrix[2][0] * rotationFactor;
                    result[2][1] = matrix[2][1] * rotationFactor;
                
                    return result;
                }
                
                void main() {
                    vUv = uv;

                    vec4 transformed = vec4(position, 1.0);

                    // Tip: 应该在GPU中计算好 因为旋转矩阵，只要计算一次就足够了，不用每一次顶点都要计算，不过当前作用在平面上一共就四个点，计算不大
                    mat4 adjustRotationMatrix = adjustRotation(modelViewMatrix,rotationFactor);

                    vec4 modelPosition = adjustRotationMatrix * transformed;

                    gl_Position = projectionMatrix * modelPosition;
                }
            `,
            fragmentShader: /* glsl */ `
                varying vec2 vUv;
                uniform sampler2D map;

                void main() {
                   
                    vec3 color = texture2D(map,vUv).rgb;
                    
                    gl_FragColor = vec4(color , 1.); 
                }
            `,
        });
    }
}

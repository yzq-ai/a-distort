/*
 * @Author: hongbin
 * @Date: 2024-01-11 13:05:48
 * @LastEditors: hongbin
 * @LastEditTime: 2024-06-19 10:07:55
 * @Description: 拓展反射镜面shader
 * @TODO：一面添加了 EtchMap 反射这一面镜子的画面 没有反射铸刻贴图的纹理
 * //!  相机移动到特殊视角时会出现其他物体出现镜面中 是因为在当前视角下镜面的虚拟渲染相机 在物体后面渲染 而镜面后面的物体不是FrontSide 则会造成渲染被该物体遮挡 出现该物体的图像 需要调整改物体为FrontSide
 * 唯一渲染镜面方案带来的刁钻问题：一个渲染镜面 三个小镜面（a，b，c）共用  这时其他镜面渲染需要渲染这三个镜面 假设a镜面在这个镜面之前渲染完毕 生成了公用纹理 然后这一镜面渲染了b镜面 于是改变了公用镜面的纹理 之后渲染的c镜面使用的纹理就是其他镜面中看到公用镜面的画面了 导致公用镜面渲染结果不一致 其实是先渲染的镜面使用这个纹理先前的渲染结果 后渲染的使用的纹理已经被其他镜面改变的
 * //!try: 两个renderTarget  主相机一个 如果是主相机渲染 设置tDiffuse为主相机的renderTarget 虚拟相机渲染 保存到另一个纹理
 * 每次被虚拟相机渲染 创建一个对应的renderTarget 同子集物体在次被渲染 直接使用这个renderTarget
 * //TODO resolution 属性增加模糊 方式失效 因为使用的纹理都是一张  需要寻找新的方式增加模糊度
 * 问题：互相渲染问题  RenderedCamera 记录被哪个相机渲染了 再次被渲染则采用之前的 而互相渲染镜面则暴露了这个问题
 * 过程：a渲染b  b中又渲染a  之后a的渲染结束 带到b开始渲染 b渲染a 可是之前b在a的渲染中已经渲染过a了导致被意外优化
 * 思路：寻找互相渲染关系 互相渲染的 允许独立渲染 复用之前的 虚拟相机位置不对->显示不对
 * 补充：当好几块镜面时 还要记住这些镜面用之前独立渲染的
 * 描述：
 */
import {
    Color,
    Matrix4,
    Mesh,
    PerspectiveCamera,
    Plane,
    ShaderMaterial,
    UniformsUtils,
    Vector3,
    Vector4,
    HalfFloatType,
    Vector2,
    WebGLRenderTarget,
} from "three";
import * as THREE from "three";

class MyWebGLRenderTarget extends WebGLRenderTarget {
    constructor(width = 1, height = 1, options = {}) {
        super(width, height, options);
        this.params = [width, height, options];
    }

    create(name) {
        if (!this[name]) {
            this[name] = new WebGLRenderTarget(...this.params);
            this[name].texture.AType = "vCamera" + name;
        }
    }
}

const consoleLog = (...arg) => {
    if (window.debugRefl) {
        console.log(Reflector.renderCount, ...arg);
        // console.log(
        //     "🤔️",
        //     Reflector.map["Refl002"].getTexture().AType,
        //     Reflector.map["吊顶Refl001"].getTexture().AType
        // );
    }
};
const modelReflLog = (...arg) => {
    if (window.modelReflLog) {
        console.log(...arg);
    }
};

class ReflMap {
    data = {};

    getKey(dir) {
        // return `${(dir.x + "").slice(0, 5)},${(dir.y + "").slice(0, 5)},${(
        //     dir.z + ""
        // ).slice(0, 5)}`;
        // return `${Math.ceil(dir.x)},${Math.ceil(dir.y)},${Math.ceil(dir.z)}`
        // return `${Math.floor(dir.x)},${Math.floor(dir.y)},${Math.floor(dir.z)}`
        return `${Math.round(dir.x)},${Math.round(dir.y)},${Math.round(dir.z)}`;
    }

    get(dir) {
        return this.data[this.getKey(dir)];
    }

    getName(dir) {
        return this.getKey(dir);
    }

    set(dir, val) {
        this.data[this.getKey(dir)] = val;
    }

    get list() {
        return Object.values(this.data);
    }
}

const hasPrevStep = (CallChain1, name) => {
    const split = CallChain1.split("->");
    if (split.length > 2 && split[split.length - 2] == name) {
        split.pop();
        return split.join("->");
    }
};

class Reflector extends Mesh {
    static map = {};
    static RenderRefl = new ReflMap();
    static renderCount = -1;
    static renderLink = [];
    static list = [];

    static clearReflector(){
        Reflector.list.forEach((refl) => {
			refl.parent && refl.parent.remove(refl)
			refl.geometry.dispose();
			refl.material.dispose();
			refl.dispose();
		});
        Reflector.renderLink = []
        Reflector.map = {}
        Reflector.RenderRefl = new ReflMap()
        Reflector.list = []
    }

    static openOptimize() {
        window.optimize = true;
    }
    /** 取靠近世界中心的镜面的位置 作为唯一渲染镜面的位置 */
    static NearPositionX() {
        Reflector.isNearPositionX = true;
    }

    /** 当前渲染链条中的重复渲染 */
    static IsHasRenderInInner(chain) {
        return Reflector.recursion(
            Reflector.renderLink[Reflector.renderCount],
            (camera, _refl, CallChain) => {
                if (CallChain == chain) {
                    return true;
                }
            }
        );
    }

    /** 所有渲染链条中的重复渲染 */
    static IsHasRenderInOuter(chain) {
        return Reflector.renderLink.some(link => {
            return Reflector.recursion(link, (camera, _refl, CallChain) => {
                if (CallChain == chain) {
                    return true;
                }
            });
        });
    }

    static recursion(link, call, CallChain = "主相机", last = "") {
        const linkCount = link.links.length;
        if (last) {
            if(linkCount){
                const element = link.links[linkCount - 1];
                const res = call(
                    link.renderCamera,
                    element,
                    `${CallChain}->${element.reflName}`
                );
                if (res) return res;

                const _res = Reflector.recursion(
                    element,
                    call,
                    `${CallChain}->${element.reflName}`,
                    last
                );
                if (_res) return _res;
            }
        } else {
            for (let index = 0; index < linkCount; index++) {
                const element = link.links[index];
                const res = call(
                    link.renderCamera,
                    element,
                    `${CallChain}->${element.reflName}`
                );
                if (res) return res;

                const _res = Reflector.recursion(
                    element,
                    call,
                    `${CallChain}->${element.reflName}`,
                    last
                );
                if (_res) return _res;
            }
        }
    }

    static record(renderCamera, refl) {
        const isHasRender = Reflector.append(renderCamera, refl);
        // console.log("isHasRender:",isHasRender);
        return isHasRender;
    }

    static appendShowRefl(names) {
        Reflector.renderLink[Reflector.renderCount].showRefl = [
            ...(Reflector.renderLink[Reflector.renderCount].showRefl || []),
            ...names,
        ];
    }

    static append(renderCamera, refl) {
        if (!Reflector.renderLink[Reflector.renderCount]) {
            const chain = `主相机->${refl.name}`;
            const isHasRenderInOuter = Reflector.IsHasRenderInOuter(chain);
            Reflector.renderLink.push({
                renderCamera,
                links: [
                    {
                        renderCamera: refl.camera,
                        links: [],
                        reflName: refl.name,
                        chain,
                    },
                ],
            });
            return { chain, isHasRender: isHasRenderInOuter };
        } else {
            const link = Reflector.renderLink[Reflector.renderCount];
            const res = Reflector.recursion(
                link,
                (camera, _refl, CallChain) => {
                    // console.log(renderCamera.name,_refl.renderCamera.name)
                    if (_refl.renderCamera.name == renderCamera.name) {
                        const chain = `${CallChain}->${refl.name}`;
                        // 查找有没有渲染过
                        const isHasRenderInInner =
                            Reflector.IsHasRenderInInner(chain);

                        _refl.links.push({
                            renderCamera: refl.camera,
                            links: [],
                            reflName: refl.name,
                            chain,
                        });
                        return { chain, isHasRender: isHasRenderInInner };
                    }
                },
                "主相机",
                true
            );
            return res;
        }
    }

    static beforeRender() {
        // Object.values(Reflector.map).forEach((mesh) => {
        //     mesh.userData.render = false;
        //     mesh.RenderedCamera = {};
        // });
        Reflector.renderCount = -1;
        Reflector.renderLink = [];
    }

    static afterRender() {
        Reflector.RenderRefl.list.forEach(mesh => {
            mesh.visible = false;
        });
    }

    static afterRenderFn = [];

    static onAfterRender(call) {
        Reflector.afterRenderFn.push(call);
    }

    get opacity (){
        if (this.material.defines.USE_EtchMap) {
            return this.material.uniforms["otherOpacity"].value;
        } else {
            return this.material.uniforms["_opacity"].value;
        }
    }

    set opacity (o){
        if (this.material.defines.USE_EtchMap) {
            this.material.uniforms["otherOpacity"].value = o;
        } else {
            this.material.uniforms["_opacity"].value = o;
        }
    }

    isLoopRender(chain) {
        const split = chain.split("->");
        if (
            split.length > 4 &&
            split.filter(step => step == this.name).length > 1
        ) {
            const firstIndex = split.findIndex(x => x == this.name);
            split.length = firstIndex + 1;
            return split.join("->");
        }
    }

    /** 找到 出现在镜面中的镜面 唯一渲染镜面调用 */
    findRenderOtherRefl() {
        const RenderReflKey = [
            ...Object.keys(Reflector.RenderRefl.data),
            ...this.userData.includes,
        ];
        // 存在同方向每个单独的镜面都filter不通的镜面的情况
        // 同方向有一个渲染了其他镜面就算一个 而不能被其他同方向镜面排除掉这一个需要渲染的镜面
        const everyShow = [];
        this.userData.includesMesh.forEach(m => {
            const allReflName = Object.keys(Reflector.map).filter(
                n => !RenderReflKey.includes(n)
            );
            m.options.filter.forEach(name => {
                const index = allReflName.findIndex(n => n == name);
                if (index != -1) {
                    allReflName.splice(index, 1);
                }
            });
            everyShow.push(...allReflName);
        });
        // consoleLog(this.name, this.userData.includesMesh, [...new Set(everyShow)]);
        return [...new Set(everyShow)];
    }

    /** 镜面后面可能遮挡的物体 唯一渲染镜面调用 */
    findRenderReflBack(scene) {
        const dir = [...this.dir].map(s => -Math.round(s));
        const index = [...dir].findIndex(n => n != 0);
        const hasValueAxis = ["x", "y", "z"][index];

        const isBackObj =
            dir[index] == 1
                ? obj => obj._center[hasValueAxis] > this.position[hasValueAxis]
                : obj =>
                      obj._center[hasValueAxis] < this.position[hasValueAxis];

        const backObj = [];
        scene.traverse(obj => {
            if (
                (obj.type == "SkinnedMesh" || obj.type == "Mesh") &&
                obj.visible && obj.name.indexOf('按钮') == -1
            ) {
                if (!obj._center) {
                    obj.box3 = new THREE.Box3();
                    obj.box3.setFromObject(obj);
                    obj._center = obj.box3.getCenter(new THREE.Vector3());
                }
                if (isBackObj(obj)) {
                    backObj.push(obj);
                }
            }
            // if(obj.name.includes('操纵箱自带指层器')){
            //     backObj.push(obj);
            // }
        });
        consoleLog(this.name, backObj);
        return visible => {
            backObj.forEach(m => {
                m.visible = visible;
            });
        };
    }

    /**
     * 设置唯一渲染镜面的位置 this指向正常镜面实例
     */
    setRenderReflPosition(target) {
        if (!window.optimize) throw new Error("window.optimize is not defined");
        const dir = {
            x: -Math.round(this.dir.x),
            y: -Math.round(this.dir.y),
            z: -Math.round(this.dir.z),
        };

        if (Math.abs(dir.x) === 1) {
            if(this?.info?.forceX){
                //强制设置镜面位置 为CM19-46提供 默认处理镜面在弧形后壁前 距离不对 该方法为后壁镜面设置
                target.position.x = this.position.x;
                target.position.z = 0;    
            }else{
                // 取近点
                if(Reflector.isNearPositionX && target.position.x != 0){
                    if(Math.abs(target.position.x) > Math.abs(this.position.x)){
                        target.position.x = this.position.x;
                        target.position.z = 0;    
                    }
                } else {
                    target.position.x = this.position.x;
                    target.position.z = 0;
                }
            }
        }
        if (Math.abs(dir.z) === 1) {
            target.position.x = 0;
            target.position.z = this.position.z;
        }
        if (Math.abs(dir.y) === 1) {
            target.position.x = 0;
            target.position.z = 0;
        }

        // // x轴有轿门占据较大宽度 一般轿门 0.08 双层开门的 还要大
        // target.position.x = window.optimize.x / 2 * dir.x + dir.x * -0.06;
        // // 轿门侧
        // if(dir.x === 1){

        // }
        target.position.y = this.position.y;
        target.dir = this.dir;
        // target.position.z = window.optimize.z / 2 * dir.z + dir.z * -0.06;
    }
    /** 每一帧被哪些相机渲染 */
    RenderedCamera = {};

    constructor(geometry, options = {}) {
        super(geometry);
        Reflector.map[options.name] = this;
        Reflector.list.push(this);
        this.name = options.name;
        window.Reflector = Reflector;
        this.isReflector = true;
        this.OnlyRenderRefl = options.OnlyRenderRefl;

        this.type = "Reflector";
        this.camera = new PerspectiveCamera();

        const scope = this;
        this.options = options;
        const color =
            options.color !== undefined
                ? new Color(options.color)
                : new Color(0xffffff);
        const textureWidth = options.textureWidth || 512;
        const textureHeight = options.textureHeight || 512;
        const clipBias = options.clipBias || 0;
        const shader = options.shader || { ...Reflector.ReflectorShader };
        if (options.etchMap) {
            shader.defines = { ...shader.defines, USE_EtchMap: true };
            if (options.etchMapTri) {
                shader.defines["USE_EtchMapTri"] = true;
            }
            if (options.etchMapInv) {
                shader.defines["EtchMapInv"] = true;
            }
        }
        if (options.shapeMap) {
            shader.defines = { ...shader.defines };

            shader.defines["USE_ShapeMap"] = true;
            shader.uniforms["IShapeMap"] = { value: options.shapeMap };
        }
        
        if (options.Divider) {
            shader.defines = { ...shader.defines, Divider: true };
        }
        
        const multisample =
            options.multisample !== undefined ? options.multisample : 4;

        const reflectorPlane = new Plane();
        const normal = new Vector3();
        const reflectorWorldPosition = new Vector3();
        const cameraWorldPosition = new Vector3();
        const rotationMatrix = new Matrix4();
        const lookAtPosition = new Vector3(0, 0, -1);
        const clipPlane = new Vector4();

        const view = new Vector3();
        const target = new Vector3();
        const q = new Vector4();

        const textureMatrix = new Matrix4();
        const virtualCamera = this.camera;
        this.camera.name = "refCamera" + options.name + Math.random();

        const renderTarget = new MyWebGLRenderTarget(
            textureWidth,
            textureHeight,
            { samples: 1, type: HalfFloatType }
        );
        // renderTarget.texture.minFilter = 1008;
        this.renderTarget = renderTarget;
        const material = new ShaderMaterial({
            name: shader.name !== undefined ? shader.name : "unspecified",
            uniforms: UniformsUtils.clone(shader.uniforms),
            fragmentShader: shader.fragmentShader,
            vertexShader: shader.vertexShader,
            transparent: true,
            defines: {...shader.defines},
            // side: 2,
        });
        if (options.blur) {
            material.defines = { ...material.defines, USE_BLUR: true };
        }
        this.setBlur = state => {
            material.defines.USE_BLUR = state;
        };
        if (options.side != undefined) {
            material.side = options.side;
        }

        this.setEtchParams = (
            map,
            etchMapScale = 1,
            etchMapTri = true,
            etchMapInv = false,
            opacity = 1,
            otherOpacity = 1,
            baseColor = new THREE.Color("#888888"),
            repeat = new THREE.Vector2(1, 1)
        ) => {
            const uniforms = material.uniforms;
            const defines = material.defines;

            if (
                map.path == uniforms.etchMap?.value?.path &&
                baseColor.equals(uniforms["IEtchMapBaseColor"].value) &&
                etchMapScale == uniforms["scale"].value &&
                opacity == uniforms["_opacity"].value &&
                uniforms["otherOpacity"].value == otherOpacity &&
                repeat.equals(uniforms["xyRepeat"].value) &&
                defines["USE_EtchMapTri"] == etchMapTri &&
                defines["EtchMapInv"] == etchMapInv &&
                defines["USE_EtchMap"] == !!map
            ) {
                return false;
            }

            if (map) {
                map.wrapT = THREE.RepeatWrapping;
                map.wrapS = THREE.RepeatWrapping;
            }
            material.defines = { ...material.defines, USE_EtchMap: !!map };
            material.defines["USE_EtchMapTri"] = etchMapTri;
            material.defines["EtchMapInv"] = etchMapInv;
            material.uniforms["IEtchMapBaseColor"].value = baseColor;
            material.uniforms["etchMap"].value = map;
            material.uniforms["scale"].value = etchMapScale;
            material.uniforms["_opacity"].value = opacity;
            material.uniforms["otherOpacity"].value = otherOpacity;
            material.uniforms["xyRepeat"].value = repeat;
            return true;
        };

        // material.uniforms["tDiffuse"].value = renderTarget.texture;
        material.uniforms["tDiffuse"] = new ListenerValue(renderTarget.texture);
        // .value = renderTarget.texture;

        this.setTexture = (renderTarget, tag, ...other) => {
            if (renderTarget.texture) {
                material.uniforms["tDiffuse"].value = renderTarget.texture;
                this.saveRenderTarget = true;
                if (tag && window.debugRefl) {
                    console.log("切换纹理", tag, ...other);
                    // console.log(Reflector.map["后中壁反射面"].getTexture().AType);
                }
            }
        };

        this.getTexture = () => {
            return material.uniforms["tDiffuse"].value;
        };
        material.uniforms["_opacity"].value = options.opacity != undefined ? options.opacity : 1;
        material.uniforms["otherOpacity"].value =
            options.otherOpacity != undefined ? options.otherOpacity : 0;
        this.setOpacity = o => {
            if (material.defines.USE_EtchMap) {
                material.uniforms["otherOpacity"].value = o;
            } else {
                material.uniforms["_opacity"].value = o;
            }
        };
        material.uniforms["color"].value = color;
        material.uniforms["textureMatrix"].value = textureMatrix;
        material.uniforms["etchMap"].value = options.etchMap;
        material.uniforms["scale"].value = options.etchMapScale || 0.1;
        material.uniforms["blurFactor"] = {
            value: options.blurFactor == undefined ? 1 : options.blurFactor,
        };
        this.setBlurFactor = v => {
            material.uniforms["blurFactor"] = { value: v };
        };
        material.uniforms["iResolution"] = options.iResolution;
        if (options.otherColor) {
            consoleLog("options.otherColor:", options.otherColor);
            material.uniforms["otherColor"].value = options.otherColor;
        }

        this.setResolution = v2 => {
            if (isNaN(v2)) {
                console.warn(
                    "setResolution参数已弃用 可使用blurFactor替代",
                    v2
                );
            } else {
                material.uniforms["blurFactor"].value = v2;
            }
        };

        this.setColor = c => {
            material.uniforms["color"].value = new THREE.Color(c);
        };

        if (options.etchMapColor) {
            material.uniforms["IEtchMapColor"] = {
                value: options.etchMapColor,
            };
            this.setEtchMapColor = c => {
                material.uniforms["IEtchMapColor"].value = new THREE.Color(c);
            };
        }
        this.setOtherOpacity = c => {
            material.uniforms["otherOpacity"].value = c;
        };
        this.setOtherColor = c => {
            material.uniforms["otherColor"].value = new THREE.Color(c);
        };
        if (options.etchMapBaseColor) {
            material.uniforms["IEtchMapBaseColor"] = {
                value: options.etchMapBaseColor,
            };
            this.setEtchMapBaseColor = c => {
                material.uniforms["IEtchMapBaseColor"].value = new THREE.Color(
                    c
                );
            };
        }
        this.material = material;
        this.onBeforeRender = (renderer, scene, camera, _call_name) => {
            if (material.uniforms["_opacity"].value < 0.01) {
                scope.visible = false;
                this.onAfterRender = () => {
                    scope.visible = false;
                    this.onAfterRender = () => {};
                };
                return;
            }
            if (window.debugRefl) {
                debugger;
            }
            let optimize;
            // 记录渲染调用链
            if (this.OnlyRenderRefl) {
                if (!/refCamera/.test(camera.name)) Reflector.renderCount++;
                optimize = Reflector.record(camera, this);
            }

            consoleLog(
                "-----------" + this.name + "-----------" + _call_name,
                camera.CallChain,
                optimize?.chain
            );

            if (optimize && optimize.isHasRender) {
                const LoopRenderName = this.isLoopRender(optimize.chain);
                if (LoopRenderName) {
                    this.userData.includesMesh.forEach(refl => {
                        refl.setTexture(renderTarget[LoopRenderName], 1);
                    });
                } else {
                    this.userData.includesMesh.forEach(refl => {
                        refl.setTexture(renderTarget[optimize.chain], 2);
                    });
                }

                const name = this.name;
                Reflector.onAfterRender(function () {
                    if(!Reflector.map[name]) return;
                    Reflector.map[name].userData.includesMesh.forEach(refl => {
                        refl.setTexture(renderTarget[`主相机->${name}`], 3);
                    });
                });
                consoleLog(
                    "优化：",
                    this.name,
                    "虚拟相机重复渲染一次",
                    camera.name,
                    _call_name,
                    optimize?.chain
                );
                return;
            }
            // 其他镜面渲染 创建新的renderTarget保存结果
            if (optimize && !optimize.isHasRender) {
                renderTarget.create(optimize.chain);
            }

            consoleLog(
                this.name + "被" + camera.name + "渲染了",
                optimize?.chain
            );

            const filter = [...options.filter];
            if (!this.OnlyRenderRefl && window.optimize) {
                const dir =
                    this.dir || this.getWorldDirection(new THREE.Vector3());

                let onlyRenderRefl = Reflector.RenderRefl.get(dir);
                this.dir = dir;
                if (!onlyRenderRefl) {
                    // 大屏 缩小绘制纹理大小
                    const scale = window.innerWidth > 750 ? 1.3 : 1;
                    onlyRenderRefl = new Reflector(
                        new THREE.PlaneGeometry(1, 1),
                        {
                            opacity: 1,
                            blur: false,
                            clipBias: 0.1,
                            resolution: 1,
                            textureWidth: window.innerWidth / scale,
                            textureHeight: window.innerHeight / scale,
                            name: `${Reflector.RenderRefl.getName(dir)}`,
                            OnlyRenderRefl: true,
                            filter: [],
                        }
                    );
                    this.parent.add(onlyRenderRefl);
                    onlyRenderRefl.visible = false;
                    Reflector.RenderRefl.set(dir, onlyRenderRefl);
                    onlyRenderRefl.rotation.copy(this.rotation);
                    !Reflector.isNearPositionX && this.setRenderReflPosition(onlyRenderRefl);
                     
                    if (window.ReflectorGUI) {
                        window.ReflectorGUI(onlyRenderRefl, {
                            opacity: 1,
                            blur: false,
                            clipBias: 0.1,
                            resolution: 1,
                            textureWidth: window.innerWidth,
                            textureHeight: window.innerHeight,
                            name: `${Reflector.RenderRefl.getName(dir)}`,
                            OnlyRenderRefl: true,
                            filter: [],
                            iResolution: 1,
                        });
                    }
                }
                Reflector.isNearPositionX && this.setRenderReflPosition(onlyRenderRefl);
                
                if (!onlyRenderRefl.userData.includes)
                    onlyRenderRefl.userData.includes = [];

                if (!onlyRenderRefl.userData.includesMesh)
                    onlyRenderRefl.userData.includesMesh = [];

                this._onlyRenderRefl = onlyRenderRefl;
                if (!onlyRenderRefl.userData.includes.includes(this.name)) {
                    onlyRenderRefl.userData.includes.push(this.name);
                }
                // 只在HSD系统 目前不知为何会同样的创建两份 两份都保存吧😩
                if (
                    !onlyRenderRefl.userData.includesMesh.filter(
                        r => r.uuid == this.uuid
                    ).length
                ) {
                    onlyRenderRefl.userData.includesMesh.push(this);
                }
                onlyRenderRefl.renderTarget.create(
                    `主相机->${Reflector.RenderRefl.getName(dir)}`
                );
                // 不能每次都重置到主相机纹理
                if (!/refCamera/.test(camera.name)) {
                    this.setTexture(
                        onlyRenderRefl.renderTarget[
                            `主相机->${Reflector.RenderRefl.getName(dir)}`
                        ],
                        4
                    );
                }
                onlyRenderRefl.onBeforeRender(
                    renderer,
                    scene,
                    camera,
                    this.name
                );
            }
            let showRefl = [];
            if (this.OnlyRenderRefl) {
                showRefl = this.findRenderOtherRefl();
                filter.push(
                    ...Object.keys(Reflector.map).filter(
                        x => x != this.name && !x.OnlyRenderRefl
                    )
                );
            }
            // 世界位置
            reflectorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
            // 渲染相机位置
            cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
            // 旋转矩阵
            rotationMatrix.extractRotation(scope.matrixWorld);
            // THREE.JS默认法相 朝向z轴
            normal.set(0, 0, 1);
            // 应用旋转矩阵
            normal.applyMatrix4(rotationMatrix);
            // 模型位置减相机位置  距离
            view.subVectors(reflectorWorldPosition, cameraWorldPosition);
            // 避免在镜面背对时渲染
            // view.x * normal.x + view.y * normal.y + view.z * normal.z
            if (view.dot(normal) > 0) {
                if (optimize && optimize.chain) {
                    const LoopRenderName = this.isLoopRender(optimize.chain);
                    if (LoopRenderName) {
                        // console.log(optimize.chain,LoopRenderName)
                        this.userData.includesMesh.forEach(refl => {
                            refl.setTexture(renderTarget[LoopRenderName], 5);
                        });
                    }
                }
                // if (window.debugRefl) {
                //     optimize &&
                //         console.log("view.dot(normal) > 0", optimize.chain);
                // }
                return;
            }
            //reflect view.sub( _vector.copy( normal ).multiplyScalar( 2 * view.dot( normal ) ) );
            //在与法线正交的平面外反射入射矢量
            //法线被假定为具有单位长度
            //negate *= -1 取反
            view.reflect(normal).negate();
            // 渲染镜面的相机的世界位置
            view.add(reflectorWorldPosition);
            //获取渲染相机的旋转矩阵
            rotationMatrix.extractRotation(camera.matrixWorld);

            //默认法相的背面
            lookAtPosition.set(0, 0, -1);
            // 应用矩阵变换
            lookAtPosition.applyMatrix4(rotationMatrix);
            // 加上渲染相机位置
            lookAtPosition.add(cameraWorldPosition);
            //镜面位置 减 视线位置
            target.subVectors(reflectorWorldPosition, lookAtPosition);
            target.reflect(normal).negate();
            target.add(reflectorWorldPosition);

            virtualCamera.position.copy(view);
            // 设为默认值
            virtualCamera.up.set(0, 1, 0);
            // 应用旋转
            virtualCamera.up.applyMatrix4(rotationMatrix);
            // 变换到镜面向量
            virtualCamera.up.reflect(normal);
            // 旋转 朝向目标位置
            virtualCamera.lookAt(target);
            virtualCamera.far = camera.far; // Used in WebGLBackground
            virtualCamera.updateMatrixWorld();
            virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
            // 模拟着色器过程 设置着色矩阵参数 改参数传递到shader中
            textureMatrix.set(
                0.5,
                0.0,
                0.0,
                0.5,
                0.0,
                0.5,
                0.0,
                0.5,
                0.0,
                0.0,
                0.5,
                0.5,
                0.0,
                0.0,
                0.0,
                1.0
            );
            textureMatrix.multiply(virtualCamera.projectionMatrix);
            textureMatrix.multiply(virtualCamera.matrixWorldInverse);
            textureMatrix.multiply(scope.matrixWorld);

            // 模拟下方链接中的shader的修改投影矩阵的计算
            // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
            // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
            reflectorPlane.setFromNormalAndCoplanarPoint(
                normal,
                reflectorWorldPosition
            );
            reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);

            clipPlane.set(
                reflectorPlane.normal.x,
                reflectorPlane.normal.y,
                reflectorPlane.normal.z,
                reflectorPlane.constant
            );

            const projectionMatrix = virtualCamera.projectionMatrix;

            q.x =
                (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) /
                projectionMatrix.elements[0];
            q.y =
                (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) /
                projectionMatrix.elements[5];
            q.z = -1.0;
            q.w =
                (1.0 + projectionMatrix.elements[10]) /
                projectionMatrix.elements[14];

            // Calculate the scaled plane vector
            clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

            // Replacing the third row of the projection matrix
            projectionMatrix.elements[2] = clipPlane.x;
            projectionMatrix.elements[6] = clipPlane.y;
            projectionMatrix.elements[10] = clipPlane.z + 1.0 - clipBias;
            projectionMatrix.elements[14] = clipPlane.w;

            if (!this.saveRenderTarget) {
                // Render
                scope.visible = false;

                const currentRenderTarget = renderer.getRenderTarget();

                const currentXrEnabled = renderer.xr.enabled;
                const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
                renderer.xr.enabled = false; // Avoid camera modification
                renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows
                if (this.OnlyRenderRefl) {
                    if (/refCamera/.test(camera.name) && optimize) {
                        // renderer.setRenderTarget(renderTarget[camera.name]);

                        renderer.setRenderTarget(renderTarget[optimize.chain]);
                        const name = this.name;

                        Reflector.map[name].userData.includesMesh.forEach(
                            refl => {
                                // if(window.debugRefl){
                                //     console.log("🤔🤔🤔",refl)
                                // }
                                refl.setTexture(
                                    renderTarget[optimize.chain],
                                    6,
                                    optimize.chain
                                );
                            }
                        );
                        Reflector.onAfterRender(function () {
                            Reflector.map[name].userData.includesMesh.forEach(
                                refl => {
                                    refl.setTexture(
                                        renderTarget[`主相机->${name}`],
                                        7
                                    );
                                }
                            );
                        });
                        consoleLog(
                            "渲染：",
                            this.name + "虚拟相机渲染一次",
                            this.userData.render,
                            camera.name,
                            _call_name
                        );
                    } else {
                        // renderer.setRenderTarget(renderTarget);
                        renderer.setRenderTarget(
                            renderTarget[`主相机->${this.name}`]
                        );
                        this.userData.includesMesh.forEach(refl => {
                            refl.setTexture(
                                renderTarget[`主相机->${this.name}`],
                                8
                            );
                        });
                        consoleLog(
                            "渲染：",
                            this.name + "主渲染一次",
                            this.userData.render,
                            camera.name,
                            _call_name
                        );
                    }
                } else {
                    renderer.setRenderTarget(renderTarget);
                }
                renderer.state.buffers.depth.setMask(true); // make sure the depth buffer is writable so it can be properly cleared, see #18897

                if (renderer.autoClear === false) renderer.clear();

                // filter
                if (window.debugRefl) {
                    console.log("filter:", filter);
                }
                filter.forEach(name => {
                    const mesh = scene.getObjectByName(name);
                    mesh && (mesh.visible = false);
                });

                (window.list ? window.list : []).forEach(obj => {
                    obj.visible =
                        !window.inner &&
                        this.name == "0,-1,0" &&
                        !/refCamera/.test(camera.name)
                            ? false
                            : true;
                    // obj.visible = true;
                });
                if (
                    window.floor_Group &&
                    this.name == "0,-1,0" &&
                    !/refCamera/.test(camera.name)
                ) {
                    window.floor_Group.visible = true;
                }
                if (window.debugRefl) {
                    console.log("window.list:", window.list);
                }
                (window.prevList ? window.prevList : []).forEach(obj => {
                    obj.visible = true;
                });
                // TODO 门灯横梁在某些角度 阻挡轿顶反射
                // if (this.position.y >= window.y && window.axisMesh) {
                //     window.axisMesh["+Y"].forEach(obj => {
                //         obj.visible = false;
                //     });
                //     const mm = scene.getObjectByName("门灯横梁");
                //     if (
                //         mm &&
                //         window.helper &&
                //         window.helper.camera.position.x > window.x
                //     ) {
                //         mm.visible = false;
                //     }
                // }

                showRefl.forEach(name => {
                    const mesh = scene.getObjectByName(name);
                    mesh && (mesh.visible = true);
                });
                Reflector.appendShowRefl(showRefl);
                consoleLog("渲染镜面：", showRefl);
                if (
                    /refCamera/.test(camera.name) &&
                    camera.findRenderReflBackRes
                ) {
                    camera.findRenderReflBackRes(true);
                }
                let findRenderReflBackRes;
                if (this.OnlyRenderRefl) {
                    findRenderReflBackRes = this.findRenderReflBack(scene);
                    findRenderReflBackRes(false);
                }
                // 门和后壁互相反射的情况就会出现 门内显示的后墙中门被隐藏了 因此 在渲染前需将被上一个镜面隐藏的物体显示
                this.camera.findRenderReflBackRes = () => {
                    findRenderReflBackRes && findRenderReflBackRes(true);
                };
                // // 将透明度过低的隐藏
                // Object.values(Reflector.map).forEach(ref => {
                //     if(ref.material.uniforms._opacity.value < 0.01){
                //         ref.visible = false
                //     }
                // })

                // Reflector.renderLink[Reflector.renderCount].showRefl.forEach(name => {
                //     const mesh = scene.getObjectByName(name);
                //     mesh && (mesh.visible = false);
                // });
                renderer.render(window.scene || scene, virtualCamera);

                // 反射相机渲染完了 被渲染镜面还没渲染结束 就变回来了
                // render之后将纹理纠正 而不是afterRender 那是像素颜色已经渲染完毕 再纠正也无效 而其他复用的纹理则是正常的
                if (!/refCamera/.test(camera.name)) {
                    Reflector.afterRenderFn.forEach(fn => {
                        fn();
                    });
                    Reflector.afterRenderFn = [];
                }

                findRenderReflBackRes && findRenderReflBackRes(true);
                // consoleLog(this.name,"onBeforeRender",this.userData.render,camera.name)

                showRefl.forEach(name => {
                    const mesh = scene.getObjectByName(name);
                    mesh && (mesh.visible = false);
                });
                // if (this.position.y >= window.y && window.axisMesh) {
                //     window.axisMesh["+Y"].forEach(obj => {
                //         obj.visible = true;
                //     });
                //     const mm = scene.getObjectByName("门灯横梁");
                //     if (
                //         mm &&
                //         window.helper &&
                //         window.helper.camera.position.x > window.x
                //     ) {
                //         mm.visible = true;
                //     }
                // }
                (window.list ? window.list : []).forEach(obj => {
                    obj.visible = true;
                });
                (window.prevList ? window.prevList : []).forEach(obj => {
                    obj.visible = false;
                });
                filter.forEach(name => {
                    const mesh = scene.getObjectByName(name);
                    mesh && (mesh.visible = true);
                });

                renderer.xr.enabled = currentXrEnabled;
                renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

                renderer.setRenderTarget(currentRenderTarget);

                // Restore viewport

                const viewport = camera.viewport;

                if (viewport !== undefined) {
                    renderer.state.viewport(viewport);
                }
                if (!this.OnlyRenderRefl) {
                    scope.visible = true;
                }
            }
            consoleLog("---------" + this.name + "结束");
        };

        this.getRenderTarget = function () {
            return renderTarget;
        };

        this.dispose = function () {
            renderTarget.dispose();
            scope.material.dispose();
        };
    }

    gui() {}
}

// 监听uniform的变化
class ListenerValue {
    constructor(value) {
        this._value = value;
    }
    get value() {
        return this._value;
    }
    set value(v) {
        if (window.debugRefl) {
            console.log(v);
        }
        this._value = v;
    }
}

Reflector.ReflectorShader = {
    name: "ReflectorShader",
    defines: {},
    uniforms: {
        iResolution: {
            value: new Vector2(1, 1),
        },
        color: {
            value: new Color("#ffffff"),
        },

        tDiffuse: {
            value: null,
        },

        textureMatrix: {
            value: null,
        },
        _opacity: {
            value: null,
        },
        otherOpacity: {
            value: null,
        },
        otherColor: {
            value: new THREE.Color().set(-1, -1, -1),
        },
        etchMap: {
            value: null,
        },
        /**
         * 漫发射颜色
         */
        IEtchMapColor: {
            value: new Color("#ffffff"),
        },
        /**
         * 底色
         */
        IEtchMapBaseColor: {
            value: new Color("#000000"),
        },
        scale: {
            value: 1,
        },
        xyRepeat: { value: new THREE.Vector2(1, 1) },
        blurFactor: {
            value: 1,
        },
    },

    vertexShader: /* glsl */ `
		uniform mat4 textureMatrix;
		varying vec4 vUv;
		varying vec2 normalUv;
        varying vec2 vMapUv;
        varying vec3 tripPosition;
        varying vec3 tripNormal;
		#include <common>
		#include <logdepthbuf_pars_vertex>

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );
            normalUv = uv;
            // vMapUv = MAP_UV
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

            vec4 tripPosition4 = modelMatrix * vec4(position,1.) ;
            tripPosition = tripPosition4.xyz;
            // tripNormal = normal * normalMatrix;
            vec3 world_space_normal = vec3(modelMatrix * vec4(normal, 0.0));
            // tripNormal = normal;
            tripNormal = world_space_normal;

			#include <logdepthbuf_vertex>

		}`,

    fragmentShader: /* glsl */ `
		uniform vec3 color;
		uniform vec3 IEtchMapColor;
		uniform vec3 IEtchMapBaseColor;
		uniform float _opacity;
		uniform float otherOpacity;
		uniform vec3 otherColor;
		uniform float scale;
        uniform vec2 xyRepeat;
		uniform sampler2D tDiffuse;
		uniform sampler2D etchMap;
		varying vec4 vUv;
        varying vec2 normalUv;
        varying vec2 vMapUv;
        uniform vec2 iResolution;
        uniform float blurFactor;
        // USE_ShapeMap
        uniform sampler2D IShapeMap;

        varying vec3 tripPosition;
        varying vec3 tripNormal;
        vec3 blendNormal(vec3 normal){
            vec3 blending = abs( normal );
            blending = normalize(max(blending, 0.00001)); // Force weights to sum to 1.0 
            float b = (blending.x + blending.y + blending.z);
            blending /= vec3(b, b, b);
            return blending;
        }
        
        vec3 triplanarMapping (sampler2D tex, vec3 normal, vec3 position,float scale) {
            vec3 normalBlend = blendNormal(normal);
            vec3 xColor = texture(tex, position.zy * scale * xyRepeat).rgb;
            vec3 yColor = texture(tex, position.zx * scale * xyRepeat).rgb;
            vec3 zColor = texture(tex, position.xy * scale * xyRepeat).rgb;
            return (xColor * normalBlend.x + yColor * normalBlend.y + zColor * normalBlend.z);
        }

        vec3 triplanarMapping (sampler2D tex, vec3 normal, vec3 position,float scale,out float opacity) {
            vec3 normalBlend = blendNormal(normal);
            vec4 xColor = texture(tex, position.zy * scale * xyRepeat );
            vec4 yColor = texture(tex, position.zx* scale * xyRepeat );
            vec4 zColor = texture(tex, position.xy* scale * xyRepeat );
            opacity = (xColor.a * normalBlend.x + yColor.a * normalBlend.y + zColor.a * normalBlend.z);
            return (xColor.rgb * normalBlend.x + yColor.rgb * normalBlend.y + zColor.rgb * normalBlend.z);
        }
            
		#include <logdepthbuf_pars_fragment>

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

        vec4 blur (sampler2D map,vec4 uv,vec2 iResolution) {
            float Pi = 6.28318530718;
            float Directions = 16.0; 
            float Quality = 3.0;
            float Size = 8.0;
            vec2 Radius = Size/iResolution.xy / blurFactor;

            // vec4 Color = texture(map, uv);
            vec4 Color = texture2DProj( map, uv );
            
            for( float d=0.0; d<Pi; d+=Pi/Directions)
            {
                for(float i=1.0/Quality; i<=1.0; i+=1.0/Quality)
                {
                    // Color += texture( map, uv+vec2(cos(d),sin(d))*Radius*i);		
                    vec2 tr = vec2(cos(d),sin(d))*Radius*i;
                    vec4 trUv = vec4(uv.x + tr.x,uv.y+ tr.y,uv.z,uv.w);
                    Color += texture2DProj( map, trUv);		
                }
            }
            
            Color /= Quality * Directions - 15.0;

            return Color;
        }

		void main() {

			#include <logdepthbuf_fragment>

			vec4 base = texture2DProj( tDiffuse, vUv  );
			// vec4 base = texture( tDiffuse, normalUv ,10.);
			// vec3 etchMapColor = texture2D( etchMap, normalUv ).rgb;
            // 开启蚀(shi)刻贴图
            float triOpacity = 1.;
            #ifdef USE_EtchMap
                // 分两种情况处理  使用三面贴图和不使用
                #ifdef USE_EtchMapTri
                    vec3 etchMapColor = vec3(triplanarMapping( etchMap ,tripNormal,tripPosition,scale,triOpacity));
                #else
                    vec3 etchMapColor = texture2D( etchMap, normalUv ).rgb;
                #endif
                
                #ifdef EtchMapInv
                    etchMapColor.r = 1.0 - etchMapColor.r;
                #endif    

                #ifdef USE_BLUR
                    gl_FragColor = vec4(blur(tDiffuse,vUv,iResolution).rgb , 0.1);
                #else 
                    gl_FragColor = vec4( base.rgb , 0.1 );
                #endif

                if(triOpacity == 1.0){
                    if(etchMapColor.r < 0.6){
                        gl_FragColor.a = otherOpacity;
                        if(otherColor.r >= 0.0){
                            gl_FragColor.a = _opacity;
                            gl_FragColor.rgb = blendOverlay(otherColor,gl_FragColor.rgb);
                        }
                        // discard;
                    }
                    
                    if(etchMapColor.r >= 0.6){
                        gl_FragColor.rgb += IEtchMapBaseColor;
                        gl_FragColor.rgb *= IEtchMapColor;
                        gl_FragColor.a = _opacity;
                    }
                }else {
                    if(triOpacity < 0.1){
                        gl_FragColor.a = otherOpacity;
                        if(otherColor.r >= 0.0){
                            gl_FragColor.a = _opacity;
                            gl_FragColor.rgb = blendOverlay(otherColor,gl_FragColor.rgb);
                        }
                        // discard;
                    }
                    if(triOpacity >= 0.1){
                        gl_FragColor.rgb += IEtchMapBaseColor;
                        gl_FragColor.rgb *= IEtchMapColor;
                        gl_FragColor.a = _opacity;
                    }
                }
                // gl_FragColor.a = triOpacity;
                // gl_FragColor.rgb = etchMapColor;
                // gl_FragColor.a = 1.;
            #else
                // gl_FragColor = vec4(blur(tDiffuse,normalUv,iResolution).rgb , _opacity );
                #ifdef USE_BLUR
                    gl_FragColor = vec4(blur(tDiffuse,vUv,iResolution).rgb , _opacity );
                #else 
                    gl_FragColor = vec4(base.rgb , _opacity );
                #endif
            #endif
            gl_FragColor.rgb *= color;

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

            #ifdef Divider
                if(normalUv.x > 0.495 && normalUv.x < 0.505){
                    discard;
                }        
            #endif

            #ifdef USE_ShapeMap
                float shapeX = texture( IShapeMap, normalUv ).r;
                if(shapeX < 0.5){
                    discard;
                }
            #endif

		}`,
};

const blur = `
vec3 draw(vec2 uv) {
    return texture(iChannel0,vec2(uv.x,1.-uv.y)).rgb;   
    //return texture(iChannel0,uv).rgb;  
}

float grid(float var, float size) {
    return floor(var*size)/size;
}

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float time = iTime;
    vec2 uv = (fragCoord.xy / iResolution.xy);
    
    float bluramount = 0.05;


    //float dists = 5.;
    vec3 blurred_image = vec3(0.);
    #define repeats 60.
    for (float i = 0.; i < repeats; i++) { 
        //Older:
        //vec2 q = vec2(cos(degrees((grid(i,dists)/repeats)*360.)),sin(degrees((grid(i,dists)/repeats)*360.))) * (1./(1.+mod(i,dists)));
        vec2 q = vec2(cos(degrees((i/repeats)*360.)),sin(degrees((i/repeats)*360.))) *  (rand(vec2(i,uv.x+uv.y))+bluramount); 
        vec2 uv2 = uv+(q*bluramount);
        blurred_image += draw(uv2)/2.;
        //One more to hide the noise.
        q = vec2(cos(degrees((i/repeats)*360.)),sin(degrees((i/repeats)*360.))) *  (rand(vec2(i+2.,uv.x+uv.y+24.))+bluramount); 
        uv2 = uv+(q*bluramount);
        blurred_image += draw(uv2)/2.;
    }
    blurred_image /= repeats;
        
    fragColor = vec4(blurred_image,1.0);
}
`;

export { Reflector };

/**
 * @description: 为mesh的材质增加反光效果 只适用于平面 这是当前方案无法突破的问题
 * @param {*} mesh
 * @return {*}
 */
export function addReflectorEffect(mesh, options = { filter: [] }) {
    const material = mesh.material;

    // material.isReflector = true;

    // material.type = "Reflector";
    const camera = new PerspectiveCamera();

    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const shader = options.shader || Reflector.ReflectorShader;
    const multisample =
        options.multisample !== undefined ? options.multisample : 4;

    const reflectorPlane = new Plane();
    const normal = new Vector3();
    const reflectorWorldPosition = new Vector3();
    const cameraWorldPosition = new Vector3();
    const rotationMatrix = new Matrix4();
    const lookAtPosition = new Vector3(0, 0, -1);
    const clipPlane = new Vector4();

    const view = new Vector3();
    const target = new Vector3();
    const q = new Vector4();

    const textureMatrix = new Matrix4();
    const virtualCamera = camera;

    const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, {
        samples: multisample,
        type: HalfFloatType,
    });

    const appendUniforms = {
        refDiffuse: { value: renderTarget.texture },
        // refOpacity: { value: options.opacity || 1 },
        refTextureMatrix: { value: textureMatrix },
    };

    material.onBeforeCompile = shader => {
        consoleLog(shader);
        Object.assign(shader.uniforms, appendUniforms);
        shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `
            #include <common>
            uniform mat4 refTextureMatrix;
            varying vec4 refUv;
        `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <common>",
            `
            #include <common>
            uniform sampler2D refDiffuse;
            varying vec4 refUv;
        `
        );
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
            refUv = refTextureMatrix * vec4( position, 1.0 );
        `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <dithering_fragment>",
            `
            #include <dithering_fragment>
            
            gl_FragColor.rgb += texture2DProj( refDiffuse, refUv ).rgb;
        `
        );
        // uniform sampler2D refDiffuse;
        // varying vec4 vUv;
        // consoleLog(shader.fragmentShader);
    };

    mesh.material.onBeforeRender = (renderer, scene, camera) => {
        reflectorWorldPosition.setFromMatrixPosition(mesh.matrixWorld);
        cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);

        rotationMatrix.extractRotation(mesh.matrixWorld);

        normal.set(0, 0, 1);
        normal.applyMatrix4(rotationMatrix);

        view.subVectors(reflectorWorldPosition, cameraWorldPosition);

        // Avoid rendering when reflector is facing away

        if (view.dot(normal) > 0) return;

        view.reflect(normal).negate();
        view.add(reflectorWorldPosition);

        rotationMatrix.extractRotation(camera.matrixWorld);

        lookAtPosition.set(0, 0, -1);
        lookAtPosition.applyMatrix4(rotationMatrix);
        lookAtPosition.add(cameraWorldPosition);

        target.subVectors(reflectorWorldPosition, lookAtPosition);
        target.reflect(normal).negate();
        target.add(reflectorWorldPosition);

        virtualCamera.position.copy(view);
        virtualCamera.up.set(0, 1, 0);
        virtualCamera.up.applyMatrix4(rotationMatrix);
        virtualCamera.up.reflect(normal);
        virtualCamera.lookAt(target);

        virtualCamera.far = camera.far; // Used in WebGLBackground

        virtualCamera.updateMatrixWorld();
        virtualCamera.projectionMatrix.copy(camera.projectionMatrix);

        // Update the texture matrix
        textureMatrix.set(
            0.5,
            0.0,
            0.0,
            0.5,
            0.0,
            0.5,
            0.0,
            0.5,
            0.0,
            0.0,
            0.5,
            0.5,
            0.0,
            0.0,
            0.0,
            1.0
        );
        textureMatrix.multiply(virtualCamera.projectionMatrix);
        textureMatrix.multiply(virtualCamera.matrixWorldInverse);
        textureMatrix.multiply(mesh.matrixWorld);

        // Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
        // Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
        reflectorPlane.setFromNormalAndCoplanarPoint(
            normal,
            reflectorWorldPosition
        );
        reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);

        clipPlane.set(
            reflectorPlane.normal.x,
            reflectorPlane.normal.y,
            reflectorPlane.normal.z,
            reflectorPlane.constant
        );

        const projectionMatrix = virtualCamera.projectionMatrix;

        q.x =
            (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) /
            projectionMatrix.elements[0];
        q.y =
            (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) /
            projectionMatrix.elements[5];
        q.z = -1.0;
        q.w =
            (1.0 + projectionMatrix.elements[10]) /
            projectionMatrix.elements[14];

        // Calculate the scaled plane vector
        clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));

        // Replacing the third row of the projection matrix
        projectionMatrix.elements[2] = clipPlane.x;
        projectionMatrix.elements[6] = clipPlane.y;
        projectionMatrix.elements[10] = clipPlane.z + 1.0 - clipBias;
        projectionMatrix.elements[14] = clipPlane.w;

        // Render
        // TODO : 于一体的反光 不能将自己隐去 只是不显示反射纹理
        mesh.visible = false;

        const currentRenderTarget = renderer.getRenderTarget();

        const currentXrEnabled = renderer.xr.enabled;
        const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

        renderer.xr.enabled = false; // Avoid camera modification
        renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

        renderer.setRenderTarget(renderTarget);

        renderer.state.buffers.depth.setMask(true); // make sure the depth buffer is writable so it can be properly cleared, see #18897

        if (renderer.autoClear === false) renderer.clear();

        // filter

        options.filter.forEach(name => {
            const mesh = scene.getObjectByName(name);
            mesh && (mesh.visible = false);
        });
        (window.list ? window.list : []).forEach(obj => {
            obj.visible = true;
        });
        (window.prevList ? window.prevList : []).forEach(obj => {
            obj.visible = true;
        });
        renderer.render(scene, virtualCamera);
        (window.list ? window.list : []).forEach(obj => {
            obj.visible = false;
        });
        (window.prevList ? window.prevList : []).forEach(obj => {
            obj.visible = false;
        });
        options.filter.forEach(name => {
            const mesh = scene.getObjectByName(name);
            mesh && (mesh.visible = true);
        });

        renderer.xr.enabled = currentXrEnabled;
        renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

        renderer.setRenderTarget(currentRenderTarget);

        // Restore viewport

        const viewport = camera.viewport;

        if (viewport !== undefined) {
            renderer.state.viewport(viewport);
        }

        mesh.visible = true;
    };

    return { renderTarget };
}

import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass";
import { ThreeHelper } from "@/src/ThreeHelper";
import { MouseWater } from "./MouseWater";

interface IProps {
    iTime: { value: number };
}

export class MousePass extends Pass {
    private size = new THREE.Vector2();
    public renderTarget: THREE.WebGLRenderTarget<THREE.Texture>;
    camera: THREE.OrthographicCamera;
    mouseWater: MouseWater;

    constructor(public params: IProps) {
        super();

        const helper = ThreeHelper.instance;

        const pixelRatio = helper.renderer.getPixelRatio();

        helper.renderer.getSize(this.size).multiplyScalar(pixelRatio);

        const viewPort = this.setViewPort();

        this.camera = new THREE.OrthographicCamera(
            viewPort.left,
            viewPort.right,
            viewPort.top,
            viewPort.bottom,
            viewPort.near,
            viewPort.far
        );
        this.camera.position.set(0, 0, 100);
        // -.5 * this.size.y

        this.renderTarget = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
            magFilter: THREE.LinearFilter,
            minFilter: THREE.LinearFilter,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping,
        });

        /**
         * 适应屏幕尺寸 否则图像拉伸
         */
        helper.addResizeListen(() => {
            const viewPort = this.setViewPort();

            this.camera.left = viewPort.left;
            this.camera.right = viewPort.right;
            this.camera.top = viewPort.top;
            this.camera.bottom = viewPort.bottom;
            this.camera.near = viewPort.near;
            this.camera.far = viewPort.far;
            this.camera.updateProjectionMatrix();

            const pixelRatio = helper.renderer.getPixelRatio();

            helper.renderer.getSize(this.size).multiplyScalar(pixelRatio);

            this.renderTarget.setSize(this.size.x, this.size.y);
        });

        // const renderTarget = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
        //     magFilter: THREE.LinearFilter,
        //     minFilter: THREE.LinearFilter,
        //     wrapS: THREE.RepeatWrapping,
        //     wrapT: THREE.RepeatWrapping,
        // });

        const mouseWater = new MouseWater();

        this.mouseWater = mouseWater;
    }

    render() {
        if (!this.mouseWater) throw new Error("No mouse water");

        this.mouseWater.onRender();

        const prevTarget = ThreeHelper.instance.renderer.getRenderTarget();

        ThreeHelper.instance.renderer.setRenderTarget(this.renderTarget);

        ThreeHelper.instance.renderer.render(this.mouseWater.scene, this.camera);

        ThreeHelper.instance.renderer.setRenderTarget(prevTarget as null);
    }

    dispose() {}

    setViewPort() {
        var t = this.size.x * 0.5,
            e = this.size.y * 0.5,
            t = t / e;

        const _viewPort = {
            viewSize: e,
            aspectRatio: t,
            left: (-t * e) / 2,
            right: (t * e) / 2,
            top: e / 2,
            bottom: -e / 2,
            near: 0,
            far: 1e4,
        };

        return _viewPort;
    }
}

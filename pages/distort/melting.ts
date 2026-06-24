import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass";
import { PictureScene } from "./PictureScene";
import { ThreeHelper } from "@/src/ThreeHelper";
import { gsap } from "gsap";

interface IProps {
    // texture: THREE.Texture;
    camera: THREE.Camera;
    iTime: { value: number };
    mouseTexture: THREE.RenderTarget;
}

export class MeltingPass extends Pass {
    fsQuad: FullScreenQuad;
    uniforms: { [uniform: string]: THREE.IUniform };
    material: THREE.ShaderMaterial;
    pictureScene = new PictureScene();

    constructor(public params: IProps) {
        super();

        this.uniforms = {
            tDiffuse: { value: null },
            tPictureScene: { value: null },
            tMouseTexture: { value: params.mouseTexture.texture },
            paper: {
                value: ThreeHelper.instance.loadTexture("/public/textures/paper.png", (t) => {
                    t.colorSpace = THREE.SRGBColorSpace;
                    t.wrapS = t.wrapT = THREE.RepeatWrapping;
                }),
            },
            iTime: params.iTime,
            ease: {
                // value: 0.06,
                value: 0.0,
                // value: 1.0,
            },
            distA: {
                value: 0.6,
                // value: 1,
            },
            distB: {
                value: 2.5,
                // value: 20,
            },
            strength: {
                value: 0.05,
            },
            alpha: {
                value: 1,
            },
        };

        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: /* glsl */ `
                varying vec2 vUv;

                void main() {
                    vUv = uv;

                    vec3 transform = position;

                    vec4 modelPosition = vec4(transform, 1.0);

                    vec4 modelViewPosition = modelViewMatrix * modelPosition;

                    gl_Position = projectionMatrix * modelViewPosition;

                }
            `,
            fragmentShader: /* glsl */ `
                varying vec2 vUv;
            
                uniform sampler2D tDiffuse;
                uniform sampler2D tPictureScene;
                uniform sampler2D paper;
                uniform sampler2D tMouseTexture;
                uniform float iTime;
                uniform float iProgress;
                uniform float ease;
                uniform float distA;
                uniform float distB;
                uniform float alpha;
                uniform float strength;
                uniform float isMelting;

                void main() {
                    vec2 ppp = -1.0 + 2.0 * vUv;
                    float wScale = 1.6;

                    ppp += 0.1 * cos( ( 1.5 * wScale ) * ppp.yx + 1.1 * iTime + vec2(0.1,1.1) );
                    ppp += 0.1 * cos( ( 2.3 * wScale ) * ppp.yx + 1.3 * iTime + vec2(3.2,3.4) );
                    ppp += 0.1 * cos( ( 2.2 * wScale ) * ppp.yx + 1.7 * iTime + vec2(1.8,5.2) );
                    ppp += distA * cos( ( distB * wScale ) * ppp.yx + 1.4 * iTime + vec2(6.3,3.9) );
                    
                    float r = length( ppp );
                	float mixEase = max(0.06,ease);
                    
                    float vx = (vUv.x * mixEase) + (r * (1.0 - mixEase));
                    float vy =  vUv.y * mixEase;

                    // vec2 effectUv = vec2(vx, vy) + strength * vec2(mfSin, mfSin);
                    vec2 effectUv = vec2(vx, vy);

                    // effectUv = mix(vUv,effectUv,isMelting);

                    vec3 paperColor = texture2D(paper,vUv).rgb * min(iTime * 0.01,0.03);

                    vec3 diffuseColor = texture2D(tDiffuse,vUv).rgb;
                    vec3 MouseTexture = texture2D(tMouseTexture,vUv).rgb * strength;

	                float mfSin = sin(MouseTexture.r);

                    effectUv += vec2(mfSin, mfSin);
                    
                    vec4 color = texture2D(tPictureScene,effectUv).rgba;
                    
                    // float brightness = getBrightness(color);

                    gl_FragColor = vec4(paperColor + color.rgb + diffuseColor, color.a * alpha); 
                    // gl_FragColor = vec4(MouseTexture, color.a * alpha); 
                }
            `,
            transparent: true,
        });

        this.fsQuad = new FullScreenQuad(this.material);

        const ScrollElement = document.querySelector("#ScrollElement");

        if (!ScrollElement) throw new Error("ScrollElement not found");

        const { layout, originalLayout, groupList } = this.pictureScene;

        groupList.forEach((group, index) => {
            const p = layout[index];
            const pp = originalLayout[index];

            gsap.fromTo(
                group.position,
                { ...pp },
                {
                    ...p,
                    ease: "power4.in",
                    scrollTrigger: {
                        trigger: ScrollElement,
                        start: 0,
                        end: innerHeight,
                        scrub: true,
                    },
                }
            );
        });

        gsap.to(this.material.uniforms.ease, {
            value: 1,
            ease: "power4.in",
            scrollTrigger: {
                trigger: ScrollElement,
                start: 0,
                end: innerHeight,
                scrub: true,
                onEnterBack: () => {
                    this.pictureScene.css2DElementOpacity(0);
                    console.log("ENTER")
                },
                onLeave: () => {
                    this.pictureScene.css2DElementOpacity(1);
                    // this.pictureScene.onResize();
                },
            },
        });

        gsap.to(this.material.uniforms.strength, {
            value: 0.015,
            ease: "power4.in",
            scrollTrigger: {
                trigger: ScrollElement,
                start: 0,
                end: innerHeight,
                scrub: true,
            },
        });

        gsap.to(this.pictureScene.rotationFactor, {
            value: 0,
            ease: "power4.in",
            scrollTrigger: {
                trigger: ScrollElement,
                start: 0,
                end: innerHeight,
                scrub: true,
            },
        });

        gsap.fromTo(
            this.pictureScene.scene.position,
            { y: 0 },
            {
                y: 100,
                scrollTrigger: {
                    trigger: ScrollElement,
                    start: innerHeight,
                    end: innerHeight * 5,
                    scrub: true,
                },
            }
        );
    }

    render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
        this.pictureScene.labelRenderer?.render(this.pictureScene.scene, this.params.camera);

        this.pictureScene.render(renderer, this.params.camera);

        this.uniforms["tDiffuse"].value = readBuffer.texture;
        this.uniforms["tPictureScene"].value = this.pictureScene.renderTarget.texture;

        renderer.setRenderTarget(writeBuffer);

        this.fsQuad.render(renderer);

        renderer.setRenderTarget(null);
    }

    dispose() {
        this.material.dispose();
        this.fsQuad.dispose();
    }
}

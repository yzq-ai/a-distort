/*
 * @Author: hongbin
 * @Date: 2023-08-28 12:01:46
 * @LastEditors: hongbin
 * @LastEditTime: 2023-09-04 18:47:49
 * @Description: 音频纹理
 */
import * as THREE from "three";

export class AudioTexture {
    tAudioData?: THREE.DataTexture;
    analyser?: THREE.AudioAnalyser;
    running = false;

    constructor() {}

    asyncLoad(file: string) {
        return new Promise<THREE.DataTexture>((res, rej) => {
            if (this.running) return rej(new Error("已经执行过这个方法了"));
            this.running = true;
            const mediaElement = new Audio(file);
            mediaElement
                .play()
                .then(() => res(this.createTexture(mediaElement)))
                .catch(() =>
                    document.addEventListener(
                        "click",
                        () => {
                            console.log("点击产生交互，播放音乐 " + file);
                            mediaElement.play();
                            res(this.createTexture(mediaElement));
                        },
                        { once: true }
                    )
                );
        });
    }

    createTexture(mediaElement: HTMLAudioElement) {
        if (this.tAudioData) return this.tAudioData;

        this.destroy = () => {
            mediaElement.pause();
        };
        //将频域数据分为128份 Uint8Array(128) https://developer.mozilla.org/zh-CN/docs/Web/API/AnalyserNode/getByteFrequencyData
        const fftSize = 64;

        const listener = new THREE.AudioListener();

        const audio = new THREE.Audio(listener);

        mediaElement.loop = true;

        audio.setMediaElementSource(mediaElement);

        const analyser = new THREE.AudioAnalyser(audio, fftSize);
        this.analyser = analyser;

        this.tAudioData = new THREE.DataTexture(
            analyser.data,
            fftSize / 2,
            1,
            THREE.RedFormat
        );
        return this.tAudioData;
    }

    destroy() {}

    update() {
        if (this.analyser && this.tAudioData) {
            this.analyser.getFrequencyData();
            this.tAudioData.needsUpdate = true;
        }
    }
}

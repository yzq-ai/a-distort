export type Vector3Arr = [x: number, y: number, z: number];

export interface IParams {
    geometry: THREE.Mesh["geometry"];
    matrix: THREE.Mesh["matrix"];
    // position: Vector3Arr;
    // quaternion: [...Vector3Arr, number];
    // rotation: [...Vector3Arr, THREE.Mesh["rotation"]["order"]];
    // scale: Vector3Arr;

    up: Vector3Arr;
    userData: THREE.Mesh["userData"];
    visible: THREE.Mesh["visible"];
}

export interface IBaseProps {
    name: string;
    uuid: string;
    type: string;
    matrix: THREE.Mesh["matrix"];
    // position: Vector3Arr;
    // quaternion: [...Vector3Arr, number];
    // rotation: [...Vector3Arr, THREE.Mesh["rotation"]["order"]];
    // scale: Vector3Arr;
    up: Vector3Arr;
    userData: THREE.Mesh["userData"];
    visible: THREE.Mesh["visible"];
    children: Array<IMeshParams | IBaseProps | IPointLight>;
}

export interface IMeshParams extends IBaseProps {
    geometry: THREE.Mesh["geometry"];
}

export interface IPointLight extends IBaseProps {
    power: number;
    color: THREE.Color;
    decay: number;
    castShadow: boolean;
    distance: number;
    frustumCulled: boolean;
    intensity: number;
    layers?: any;
}

export interface IMeshParams extends IBaseProps {
    geometry: THREE.Mesh["geometry"];
}

export interface IObjectParams extends IBaseProps {}

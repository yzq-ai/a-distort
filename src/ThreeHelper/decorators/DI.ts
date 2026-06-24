/*
 * @Author: hongbin
 * @Date: 2024-01-11 09:47:41
 * @LastEditors: hongbin
 * @LastEditTime: 2024-07-20 12:45:10
 * @Description:依赖注入
 */
export type Constructable<T> = new (...args: any[]) => T;

/**
 * @description 将有参类转成无参类
 * 参数 自动注入
 */
export function Injectable<T extends { new (...args: any[]): {} }>(target: T) {
    // console.log(`----------${target.name}---------`);
    const classType = Reflect.getMetadata("design:type", target);

    const constructorParams: Constructable<any>[] = Reflect.getMetadata("design:paramtypes", target);

    // console.log("constructorParams:", constructorParams);

    if (constructorParams && constructorParams.length) {
        return class DIMain extends target {
            static instance: DIMain;

            comment = "这是经过装饰器注入的类";

            constructor(...args: any[]) {
                const params: any[] = args.concat(
                    constructorParams.slice(args ? args.length : 0).map((paramType: Constructable<any>) => {
                        const getInstance = Reflect.getMetadata("inject:class", paramType);
                        if (getInstance) {
                            return getInstance;
                        }
                        const instance = new paramType();
                        Reflect.defineMetadata("inject:class", instance, paramType);
                        return instance;
                    })
                );
                super(...params);
                // fix:装饰器 EventMesh 使用target.instance作为this导向
                // @ts-ignore
                target.instance = this;
            }
        };
    }
    return target;
}

/**
 * @description 将有参类转成无参类
 * 参数 自动注入
 */
export function Inject(target: Object, propertyKey: string) {
    // console.log(`----------${target.name}---------`);

    const propertyType = Reflect.getMetadata("design:type", target, propertyKey);

    const getInstance = Reflect.getMetadata("inject:class", propertyType);

    let _dependency;

    if (getInstance) {
        _dependency = getInstance;
    } else {
        const instance = new propertyType();
        _dependency = instance;
        Reflect.defineMetadata("inject:class", instance, propertyType);
    }

    // 给属性注入依赖
    Reflect.defineProperty(target, propertyKey, {
        value: _dependency,
    });
}

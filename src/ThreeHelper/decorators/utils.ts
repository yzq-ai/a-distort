/*
 * @Author: hongbin
 * @Date: 2024-01-25 17:04:37
 * @LastEditors: hongbin
 * @LastEditTime: 2024-01-25 17:29:59
 * @Description:
 */

export type TFunction = (...args: any[]) => void;

// export const FastDecorator = <T extends Object = Object >(
//     handle: (target: T, propertyKey: string, prev: TFunction) => void
// ) => {
//     return (target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
//         const prev = descriptor.value;
//         descriptor.value = function (...args:any[])  {
//             handle(target, propertyKey, prev);
//             prev.call(this, ...args);
//         } 
//     };
// };

/** 类中要有一个 allow方法 返回true则执行被装饰的方法 */
export const allow = () => {
    return (
        target: { instance: any; allow: () => boolean },
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor
    ) => {
        const prev = descriptor.value;
        // 不能使用尖头函数 会导致函数内部的this偏离
        descriptor.value = function (...args: any[]) {
            if (target.allow.call(target.instance)) {
                prev.call(this, ...args);
            }
        };
    };
};

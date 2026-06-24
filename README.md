# A-Distort

基于 Next.js + Three.js 实现的图片熔化扭曲后处理效果，灵感来源于 [homunculus.jp](https://homunculus.jp)。

## 效果概述

页面滚动时，图片会产生流动扭曲的熔化效果，鼠标移动会在画面上产生水波笔刷痕迹。整个场景使用自定义 GLSL Shader 实现多通道后处理渲染管线。

## 技术栈

- **框架**: Next.js 13 (Pages Router)
- **3D 引擎**: Three.js 0.170
- **动画**: GSAP + ScrollTrigger
- **样式**: styled-components
- **开发工具**: dat.gui, stats.js
- **语言**: TypeScript (启用 experimentalDecorators)

## 项目结构

```
a-distort/
├── pages/
│   ├── _app.tsx              # 全局样式 & 主题提供者
│   ├── _document.js          # 服务端样式收集 (SSR styled-components)
│   ├── index.tsx             # 首页，重定向到 /distort
│   └── distort/
│       ├── index.tsx         # 页面入口组件
│       ├── main.ts           # 主场景类 (EffectComposer 管线)
│       ├── melting.ts        # 熔化后处理 Pass (自定义 Shader)
│       ├── MousePass.ts      # 鼠标笔刷渲染 Pass
│       ├── MouseWater.ts     # 鼠标水波效果实现
│       └── PictureScene.ts   # 图片画廊场景管理
├── src/
│   ├── components/
│   │   ├── NextSEO.tsx       # SEO 组件
│   │   └── Three/
│   │       ├── Canvas.tsx    # Three.js Canvas 容器 & MainScreen 基类
│   │       ├── Layout.tsx    # 页面布局组件
│   │       └── index.tsx     # Container / Title / Desc 样式组件
│   ├── styled/
│   │   ├── GlobalStyle.ts    # 全局 CSS 样式
│   │   ├── index.tsx         # FlexDiv / A 等通用样式组件
│   │   ├── ThemeProvide.tsx  # styled-components 主题
│   │   ├── styled.d.ts       # 类型定义
│   │   └── types.ts          # 样式相关类型
│   └── ThreeHelper/          # Three.js 工具封装库
│       ├── index.ts          # ThreeHelper 核心类
│       ├── addons/           # 自定义 Three.js 补丁 (OrbitControls / WebGLRenderer 等)
│       ├── decorators/       # 依赖注入 & 方法装饰器
│       ├── helper/           # GUI / Stats 辅助工具
│       ├── types/            # 类型定义
│       └── utils/            # 工具类 (Create / BaseEnvironment / ModelLoad 等)
├── public/
│   ├── 3ds-pen.svg           # 网站图标
│   ├── textures/             # 纹理资源
│   │   ├── title2.png        # 标题图
│   │   ├── paper.png         # 纸张纹理 (熔化效果叠加)
│   │   ├── brush01.png       # 鼠标笔刷纹理
│   │   ├── projects.png      # "Projects" 标题
│   │   └── 原神/             # 图片画廊素材 (原神壁纸)
│   └── env/sky/              # 天空盒环境贴图
├── next.config.js
├── tsconfig.json
└── package.json
```

## 核心渲染架构

### EffectComposer 后处理管线

```
RenderPass (场景渲染)
    ↓
MeltingPass (熔化扭曲 + 图片画廊叠加)
    ↓
FXAAShader Pass (抗锯齿)
    ↓
OutputPass (色彩空间输出)
```

### 关键类说明

| 类 | 职责 |
|---|---|
| `Main` | 主入口，搭建 EffectComposer 管线，管理滚动动画 |
| `MeltingPass` | 自定义 GLSL Pass，实现扭曲 + 纸张纹理 + 鼠标痕迹混合 |
| `MousePass` | 将鼠标水波渲染到 RenderTarget 供 MeltingPass 采样 |
| `MouseWater` | 管理 100 个笔刷 Mesh，追踪鼠标轨迹产生水波 |
| `PictureScene` | 管理图片画廊的 3D 布局、CSS2D 标签、响应式适配 |
| `ThreeHelper` | Three.js 场景封装，提供相机/灯光/控制器/纹理加载等 |
| `MainScreen` | Canvas 组件的业务基类，提供生命周期管理 |
| `Create` | 链式 API 快速创建 Mesh (plane / box / sphere 等) |

### 装饰器系统

- `@Injectable` — 依赖注入，自动解析构造函数参数类型并注入实例
- `@MethodBaseSceneSet` — 方法装饰器，自动初始化场景基础环境（相机/灯光/GUI/Stats）
- `@ThreeHelper.InjectAnimation` — 将方法注册到逐帧动画循环
- `@ThreeHelper.AddGUI` — 将方法注册到 dat.gui 初始化回调

### 自定义 Shader 要点

**熔化扭曲 (MeltingPass fragment shader)**:
- 多层 `cos()` 叠加产生流动 UV 扰动
- `ease` uniform 控制扭曲程度（滚动驱动）
- `distA` / `distB` 控制扰动幅度和频率
- 鼠标痕迹通过 `sin()` 产生额外 UV 偏移

**旋转影响 (BaseMaterial vertex shader)**:
- `rotationFactor` uniform 控制 modelViewMatrix 中旋转分量的保留程度
- 在 GPU 中完成矩阵分解和线性插值

## 环境响应式布局

`PictureScene` 根据屏幕宽度切换三种布局：

| 宽度 | 布局 | 每行列数 |
|---|---|---|
| > 1300px | 网格 | 3 列 |
| 900-1300px | 网格 | 2 列 |
| < 900px | 单列 | 1 列 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

开发服务器启动后访问 http://localhost:3000 ，页面会自动重定向到 `/distort`。

## 浏览器兼容性

- 需要 WebGL 2.0 支持
- 使用 `requestAnimationFrame` 进行渲染循环
- CSS `backdrop-filter` 用于弹窗模糊效果（部分旧浏览器不支持）

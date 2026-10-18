# dsh-deepseek-flow

把 **DeepSeek 官网首屏的那片流动光场**搬进 DeepSeek Harness Web GUI，当作动态壁纸。

淡蓝色从顶部铺开、向下化入近白的页面底色，中间有缓慢流动的雾状纹理——和你在
<https://www.deepseek.com/> 首页看到的是同一份东西，不是"看起来像"的仿制。

<p align="center">
  <img src="docs/preview.png" alt="背景效果预览" width="720">
</p>

## 这不是图片，是真正的 WebGL

市面上大多数"官网风格壁纸"做法是截一张图或者录一段视频当背景。这个插件不是：

- **着色器逐字取自官网**。官网首屏的 `canvas.ds-flow-field-canvas` 是一个 WebGL2
  片元着色器（`type="pattern"`，checks 形状 + 值噪声扭曲 + 迭代涡流）。本插件里的
  GLSL 与该站打包产物中的源码**逐字符一致**，uniform 映射也照搬（例如
  `u_distortion = distortion/100`、`u_swirl = swirl/50`、`u_rotation = rotation/90`）。
- **参数就是官网参数**：`colors=["#8AA3D6","#FFFFFF","#FFFFFF"]`、`speed=14`、
  `distortion=20`、`swirl=12`、`swirlIterations=8`、`scale=0.5`、`rotation=-5`、
  `proportion=50`、`softness=100`、`shape=checks`、`shapeScale=10`、`offsetY=65`。
- **合成方式也照搬**：官网把 canvas 垫在
  `linear-gradient(180deg, #9cc1e7 0%, rgba(250,250,250,0) 100%)` 的 hero 渐变之上，
  页面底色 `#f9f8f8`，再给 canvas 加一层
  `linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)` 的遮罩。
  插件同样用 CSS 铺这层渐变与遮罩，canvas 只负责流动部分。

因为是实时着色器，它不占多少体积、任意分辨率都清晰、可以无限流动，也不会像
逐帧图片那样在循环点露馅。

## 功能

- 实时 WebGL2 渲染，跟随窗口尺寸与 DPI（上限 1.5x，兼顾清晰度与耗电）。
- 页面切到后台时自动暂停 `requestAnimationFrame`，不空转。
- 无 WebGL2 时自动降级为同色系 CSS 渐变，不会留一片空白。
- 把应用框架与侧栏背景设为透明，让壁纸在所有列之间连续贯通。
- 主题自适应的可读性薄纱（浅色主题白纱、深色主题黑纱）。
- 修正 Electron 桌面端的窗口拖拽：背景层是全屏 body 子元素，会吞掉
  `-webkit-app-region`，这里显式声明 `initial` 让拖拽与双击最大化恢复正常。

## 安装

这是一个标准的 out-of-tree dsh bundle：

```sh
dsh plugin --profile desktop add /path/to/dsh-deepseek-flow
```

或从 git：

```sh
dsh plugin --profile desktop add github:ifsherlock/dsh-deepseek-flow
```

装完重启应用。插件会在 profile 的 `cordis.patch.yml` 里插入一行
`deepseek-flow`，配置存在这一行里。

## 配置

| 键 | 范围 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | bool | `true` | 总开关 |
| `speed` | 0–100 | `14` | 流动速度，14 即官网原速 |
| `intensity` | 0–100 | `100` | 形变与涡流强度；0 时凝固成官网的静止帧，100 为官网原样 |
| `opacity` | 0–100 | `100` | 壁纸不透明度，调低向页面底色淡出 |
| `scrim` | 0–100 | `6` | 可读性薄纱百分比 |
| `cardOpacity` | 0–100 | `20` | 输入框玻璃白度，20 即官网 `hsla(0,0%,100%,.2)` |

宿主侧提供一个同源接口供读取/写入：

```
GET  /api/deepseek-flow/settings
POST /api/deepseek-flow/settings
```

## 输入框玻璃

官网首屏的输入框是一块玻璃：

```css
/* .ds-glass-card.ds-input-wrapper */
background-color: hsla(0, 0%, 100%, .2);   /* --ds-color-bg-input */
border: 2px solid hsla(0, 0%, 100%, .8);
backdrop-filter: blur(12px);               /* --ds-blur-glass */
:hover, :focus-within → hsla(0, 0%, 100%, .36) + border hsla(0, 0%, 100%, .25)
```

dsh 用 `--dsw-specific-input-major` 画同一个输入卡，浅色主题下它就是纯白
`#fff`（深色主题 `#2c2c2e`）——那层不透明填充会把壁纸完全挡住。插件把这张卡
换成官网配方，于是流动光场能透出来。

两个实现细节，都是踩过坑之后才这么写的：

1. **透明底和模糊都放在 `::before` 上，卡片本身设为透明。** 如果把底色留在卡片上，
   `::before` 的 `backdrop-filter` 会先采样到卡片自己的白色，玻璃就糊成一片灰。
2. **模糊不能放在卡片自身。** 卡片的 `backdrop-filter` 会把它的后代一起捕获，
   导致渲染在卡内的斜杠菜单、附件弹层失去通透感；伪元素不是它们的祖先，
   所以它们继续直接采样页面。

深色主题下按官网比例降到 8%（由同一个滑块推导），拖到 0 就是完全透明。

## 设置界面

设置 → 通用 里有一行 **DeepSeek 流动背景**，位于「外观」附近：

- **实时预览卡**：卡片里跑的是真正的着色器（独立的迷你 WebGL 上下文），
  拖动滑块立刻看到效果，不是静态示意图。
- **开关**：右上角开关即时启停壁纸。
- **五个滑块**：流动速度、形变强度、壁纸不透明度、可读性薄纱、输入框玻璃。
- 拖动时只改画面、**松手才保存**（每次手势一次写入）；保存失败会在行内提示。

滑块样式全部使用 `--dsw-alias-*` 设计 token，和官方设置项一致。

## 卸载

```sh
dsh plugin --profile desktop remove dsh-deepseek-flow
```

然后从 `cordis.patch.yml` 删掉 `deepseek-flow` 那一行。插件只移除自己添加的
canvas、遮罩与 CSS，不会碰别人的东西。

## 目录

```
dsh-deepseek-flow/
├── package.json        # dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml    # 向 profile 插入插件行
├── lib/
│   ├── index.js        # 宿主半部：设置段 + 同源路由
│   └── client.js       # 浏览器半部：WebGL 画布与官网着色器
└── icon.svg
```

## 与 `deepseek-harness-background` 的关系

两者可以并存，但没必要同时开：那个插件是"放一张图片/动图当壁纸"，这个是"跑一段
实时着色器"。想用本插件时，把那一行设成 `disabled: true` 即可。

## 许可

MIT。着色器数学与首屏配色来自 DeepSeek 官网的公开前端产物，此处用于个人界面定制。

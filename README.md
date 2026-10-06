# 观物 · 数字赏石展厅

使用提供的 GLB 模型制作的三维点云展示页，支持本地预览和 GitHub Pages 发布。模型原文件保持不变。

## 运行

```powershell
npm.cmd install
npm.cmd run dev
```

浏览器访问 http://127.0.0.1:5173 。需要通过本地服务器打开，不能直接双击 HTML。

## 交互

- 拖动旋转，滚轮或双指缩放。
- 切换「点云之形」与「模型原貌」。
- 「重演光粒成形」重播光粒散开、旋流汇聚与纹理浮现的完整动画。
- 成形粒子读取模型贴图颜色，并渐显表面纹理，保留灰绿石面与橙棕底座。
- 六种光粒：圆形微光、菱形、星芒、鳞片弧纹、流火、光环。
- 汇聚时出现玄金与玉青两道盘旋光流，配合星座连线与淡淡星轨。
- 全站中文、拉丁字母与数字使用本地毛笔字体，保留金玉渐变，文案不使用标点。
- 字体来自 Ma Shan Zheng 项目，采用 SIL Open Font License，授权文件位于 public/fonts。
- 右下角可暂停自动旋转、散开/聚合粒子、重置视角。
- 点击「藏品档案」或「观赏指南」查看弹窗。
- 支持系统减少动态效果设置。

## 构建

```powershell
npm.cmd run build
npm.cmd run preview
```

构建产物位于 `dist`，模型自动复制到构建资产中。所有运行依赖均从本地加载。

## GitHub Pages 发布

在线地址：https://lyhsdsb7-lang.github.io/guanwu-digital-gallery/

使用这个在线地址生成二维码或作为 WPS PPT 的超链接，访问者无需启动本地服务器。

仓库配置了 `.github/workflows/deploy.yml`。GitHub 仓库的 Settings → Pages 中选择 GitHub Actions 后，推送到 `main` 会自动安装依赖、构建并发布网站。

发布时 Vite 自动使用 Pages 的子路径，本地开发仍使用根路径。模型、星图和毛笔字体随网站一起部署，不依赖本机服务器。

展示版本使用 `public/models/artifact-fast.glb`，大小约 1 MB。模型网格数据与原始 GLB 完全相同，三张贴图缩至 1024 像素并压缩为 JPEG。原始 33 MB 文件仍保留为素材，不会在打开网页时下载。

页面在 HTML 到达时先显示轻量光粒开场，同时预加载展示模型。三维场景就绪后平滑交接到原有粒子动画。手机的三维画布像素比上限为 1.35，以降低绘制负担。

重新生成展示模型需要 Python 和 Pillow：`python scripts/optimize-model.py`。

本地验证发布路径：

```powershell
$env:PAGES_BASE_PATH='/guanwu-digital-gallery/'
npm.cmd run build
```

仓库包含网站源码和原始 GLB 模型。未完成的下载、运行依赖和生成的预览文件不提交。字体的 SIL Open Font License 随字体保留在 `public/fonts/MaShanZheng-OFL.txt`。

## 后续修改

- 文案和档案：`index.html`。
- 字体、配色、布局：`src/style.css` 与 `src/celestial-theme.css`。
- 模型路径、相机、点数和动画：`src/main.js`。

当前档案未填写文物名称、年代与出处，需根据真实资料补充。

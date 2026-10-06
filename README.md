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

## 离线分享

离线包位于 `output/观物离线展厅.zip`，接收者使用 Windows 10 或 11。
完整解压后双击「启动展厅.cmd」，浏览器自动打开 `http://127.0.0.1:4173/`。
PPT 中的超链接继续使用这个地址。演示结束后双击「关闭展厅.cmd」。
无需安装 Node.js、Python 或额外服务，所有模型和字体均在包内。
压缩包不包含 PPT 文件，需要另外分享你的 PPT。

重新打包：

```powershell
npm.cmd run build
python scripts/package-offline.py
```

启动器源码位于 `offline`，服务仅监听本机回环地址。
端口被其他程序占用时会提示并停止，不会改用其他地址。

## GitHub Pages 发布

仓库配置了 `.github/workflows/deploy.yml`。GitHub 仓库的 Settings → Pages 中选择 GitHub Actions 后，推送到 `main` 会自动安装依赖、构建并发布网站。

发布时 Vite 自动使用 Pages 的子路径，本地开发仍使用根路径。模型、星图和毛笔字体随网站一起部署，不依赖本机服务器。

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

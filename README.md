# Sheepkinn.github.io

Sheepkinn 的个人主页，使用纯前端 HTML、CSS 与 JavaScript 实现，并由 GitHub Pages 直接托管。

新版把 Havi 1.0.2 WordPress block theme 的视觉语言迁移成静态前端：

- 保留 Havi 的 Inter 排版、4/8/12 列网格、大留白与三栏个人首页
- 移除 PHP、WordPress、jQuery、数据库与服务端依赖
- 整理 Sheepkinn 的公开 GitHub 项目与已有个人介绍
- 完整保留四篇原始 Markdown 博文，文章页直接读取源文件渲染
- 支持本地字体、响应式导航、键盘操作、换页动画和 reduced motion
- 提供 404、Atom feed、sitemap、robots 与社交分享元数据

## Local preview

从仓库根目录启动任意静态文件服务器，例如：

```bash
python3 -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

不要直接双击 HTML 文件打开；文章页需要通过 HTTP 读取 Markdown 源文件。

## Content

- `assets/posts/*.md`：博客唯一原文来源，迁移时未改写
- `posts/*.html`：文章展示壳，运行时渲染对应 Markdown
- `pages/`：Projects、Blog、About、Contact 与旧文章 URL 兼容入口
- `assets/css/style.css`：Havi 设计变量和纯前端组件样式
- `assets/js/main.js`：导航、焦点、页面过渡与代码复制
- `assets/js/article.js`：Markdown、Mermaid、提示块与语法高亮

个人与项目信息仅来自本仓库现有内容和
[`github.com/sheepkinn`](https://github.com/sheepkinn) 的公开资料；未补造真实姓名、联系方式、履历或职位。

## Deployment

仓库使用 GitHub Pages 的 `main` 分支根目录发布模式。合并到 `main` 后，GitHub 自动部署到：

<https://sheepkinn.github.io/>

## Licenses and attribution

Havi 主题改编与 Inter 字体的许可证保存在 `licenses/`，前端依赖许可证保存在 `licenses/vendor/`。完整说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

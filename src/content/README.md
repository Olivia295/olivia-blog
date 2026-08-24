# 文章不进 GitHub

`post/`（文章 / Blogs）、`note/`（短记 / Posts）和画廊清单已加入 `.gitignore`。  
本地照常写；`git push` 只推代码，不推正文和相册。

目录约定：

```
src/content/blog/     文章 / Blogs，对应 /blogs
src/content/post/     短记 / Posts，对应 /posts
src/data/photos.json  画廊合集清单
public/media/gallery/ 画廊本地图片
public/notes/         短记配图
```

## 看毛胚（没有文章 / 短记 / 画廊）

本地另开一个预览，不读私有内容：

```bash
npm run dev:bare
```

还是 `http://localhost:4321`。看完关掉，再 `npm run dev` 就回到有文章的样子。

## 日常（本地）

不用改习惯。在这两个文件夹里写 `.md`，然后：

```bash
npm run dev
```

代码仓库和文章在同一台电脑上，本来就是结合在一起的。Git 只是假装看不见它们。

建议另存一份备份（任选）：

- 拷到 iCloud / Dropbox
- 或单独建一个 **private** GitHub 仓库，只放文章

备份目录结构保持这样：

```
olivia-blog-content/
  post/
  note/
  notes-images/
  gallery/
    photos.json
    images/
```

从本仓库导出一份：

```bash
mkdir -p ../olivia-blog-content/gallery/images
cp -R src/content/blog ../olivia-blog-content/
cp -R src/content/post ../olivia-blog-content/
mkdir -p ../olivia-blog-content/notes-images
cp -R public/notes/. ../olivia-blog-content/notes-images/ 2>/dev/null || true
cp src/data/photos.json ../olivia-blog-content/gallery/photos.json
cp -R public/media/gallery/. ../olivia-blog-content/gallery/images/ 2>/dev/null || true
```

私有仓库（可选）：

```bash
cd ../olivia-blog-content
git init
git add .
git commit -m "Kitchen writing."
gh repo create olivia-blog-content --private --source=. --push
```

## 部署时如何和代码结合

Vercel 连的是 **公开代码仓库**，看不到 gitignore 里的文件。要让线上也有文章，选一种：

### 1. 本地构建再上传（最简单）

文章只在你电脑上。构建时它们会打进静态页面，页面里不再需要 `.md`。

```bash
npm run build
npx vercel --prod
```

适合自己偶尔发布。注意：用 Vercel 的 Git 自动部署会 **没有** 这些文章。

### 2. 私有仓库，构建时拉进来（适合自动部署）

1. 上面那个 private `olivia-blog-content` 仓库准备好。
2. GitHub 生成 Fine-grained PAT，权限：该私有仓库 Read。
3. Vercel → Project → Settings → Environment Variables：

私有仓库：`https://github.com/Olivia295/olivia-blog-content`（private）

Vercel 已配置：

| Name | Value |
| --- | --- |
| `CONTENT_REPO` | `git@github.com:Olivia295/olivia-blog-content.git` |
| `CONTENT_SSH_KEY` | 只读 deploy key（base64，已放在 Vercel 里） |

`npm run build` 会先跑 `scripts/sync-content.mjs`：本地已有 `.md` 就用本地的；否则从私有仓库 clone 到 `src/content/` 再构建。

本地想从备份目录同步，也可以：

```bash
CONTENT_DIR=../olivia-blog-content npm run content:sync
```

### 3. 不要用 submodule 除非你熟悉

submodule 也能挂私有内容仓库，但克隆、Vercel SSH key 更烦。上面第 2 种够用。

## 换电脑

1. clone **代码**仓库
2. 把 `post/`、`note/` 拷回来（从备份或 `CONTENT_DIR` / `content:sync`）
3. `npm install && npm run dev`

# Personal Spaceship · 私人飞船

一艘银灰色、有人生活的私人飞船。半现实的停机舱与完整个人插画构成首页，窗外有缓缓经过的飞船和流星，窗内收藏文章、动态和相册。基于 Astro，默认生成静态网站；中英文导航、日间／夜间照明、首次登船动画、搜索、RSS 与照片浏览器均已集成。

## 启动

需要 Node.js 22.14 或更新版本，以及 npm。

```sh
npm ci
npm run dev
```

首次复制模板且没有个人内容源时，会自动载入 `sample/` 的完整示例博客。示例页明确标有“示例飞船”，使用虚构的“旅人”资料和原创插画。

```sh
npm run dev:sample    # 强制中性示例，忽略个人内容目录
npm run dev:bare      # 中性空外壳，不展示文章／动态／相册
npm run build        # 同步内容、构建页面、建立搜索索引
npm run preview      # 浏览构建后的静态网站（含搜索）
```

## 换成自己的飞船

1. 复制网站模板，运行 `npm ci`。
2. 把 `sample/` 复制到网站外的个人内容目录，例如 `../my-content`。
3. 在网站的 `spaceship.config.json` 中设置 `content.directory`；在个人目录的 `site/site.json` 中修改名字、简介、配色、社交链接和栏目。示例的 `site/site.json` 已列出完整设置。
4. 编辑个人目录中的文章、动态和相册。运行 `npm run dev` 预览，运行 `npm run build` 得到可部署的 `dist/`。

本项目继续支持 `olivia-blog` 与相邻 `olivia-blog-content` 两个目录。当没有显式设置路径，且相邻内容目录是 Git 仓库时，会自动使用它。不要编辑网站生成的 `src/content/` 或 `public/site/`。

## 集中设置

`spaceship.config.json` 是网站基础设置，个人内容目录的 `site/site.json` 覆盖其中的字段。对象逐项合并；数组整体替换，`[]` 可以清空社交链接、简介或资料项目。旧的 `site/about.json`、`site/copy.json` 仍可读取；集中设置中的 `profile`、`intro` 优先。

| 设置 | 用途 |
| --- | --- |
| `title`、`shortName`、`author`、`url`、`description` | 站名、作者、正式域名和页面信息 |
| `intro.zh`、`intro.en` | 首页个人介绍 |
| `profile` | 名字、角色、简介、资料、头像文件名、社交链接 |
| `defaultSkin` | 站点默认皮肤，`spaceship` 或 `minimal`；访客可在关于页底部选择 |
| `sections` | 文章、动态、相册、关于的导航与首页入口；`hideEmpty` 自动隐藏没有内容的栏目入口 |
| `boarding` | 是否开启首页登船动画和重播入口 |
| `home.notes`、`home.articles` | 首页短记／文章数量，默认 3／5（各 1–20）；电脑双栏等高，手机先短记后文章 |
| `home.portraitAlt.zh`、`home.portraitAlt.en` | 首页图片的具体说明；留空则使用基础说明 |
| `scene.motion` | 是否启用窗外飞船、流星和星光；默认 `true` |
| `indexable` | 是否允许搜索引擎收录；默认 `false`，准备公开后设为 `true` |
| `content.directory` | 相对于网站目录的内容源路径，也支持绝对路径 |
| `content.autoDiscoverSibling` | 是否自动发现相邻的 `olivia-blog-content` |
| `content.legacy` | 仅为旧版 `post/` 长文、`note/` 短记格式开启 |

旧的 `recentLimit` 仍可读取以兼容已有设置，第二轮首页改用 `home.notes` 和 `home.articles`。

改配色后请运行浏览器无障碍测试，确保文字对比度合格。栏目开关控制导航和首页，保留旧文章链接的可访问性。

## 内容格式与同步

完整格式和同步边界见 [内容指南](docs/CONTENT.md)。简单结构如下：

```text
my-content/
  blog/a-journey/index.md
  post/a-small-moment/index.md
  gallery/wandering/album.json
  gallery/wandering/01.jpg
  site/site.json
  site/about.jpg
  site/home-hero.jpg        # 首页右侧图片，完整比例
  site/hangar.webp          # 可选：替换默认停机舱背景
```

同步优先级：`CONTENT_MODE=sample` → `CONTENT_DIR` → `content.directory` → `CONTENT_REPO` → 相邻内容仓库 → 中性示例。显式路径失效会报错，不会保留并展示旧内容冒充新内容。切换源或删除源文件时，相应生成副本会被清理。

`npm run content:sync` 可单独同步。正在运行的开发服务器若需要读取刚在外部目录修改的内容，先同步；修改站点设置后重启开发服务器。

## 体验约定

首次进入首页时，舱窗在约 2.6 秒内开启，可用按钮或 Escape 跳过；重访立即显示内容。重新登船仅在首页底部提供；全站左下角提供暂停／恢复动效按钮，全屏照片和登船期间隐藏。导航中已移除“舱内控制”。暂停偏好在同一浏览器跨页、刷新后保留；减少动画优先于网站偏好。文章直链立即阅读。减少动画模式取消登船及位移动效。音频必须手动播放。

首页显示最新短记和文章；相册仍由主导航进入。短记预览最多四行、一张照片及照片总数，完整正文和其余照片从“阅读短记”或照片数量入口打开。文章标题最多两行，最多三个标签。内容不足时按实际数量展示；没有内容的栏目按 `sections.hideEmpty` 设置处理。

窗外首次飞船约 6–10 秒内出现，飞行一次约 26 秒，间歇出现流星；阅读页频率和亮度降低。离屏和后台时场景时钟暂停。

网站使用整页滚动。页脚在短页位于视口底部，在长页跟随内容，不覆盖正文。手机目录默认折叠，电脑目录可固定在正文旁。相册支持点击／键盘 Enter 打开、左右方向键、Home／End、滑动、全屏和明确的关闭按钮；关闭后焦点返回原图。图片失败时可重试或打开原图。无 JavaScript 时，文章、导航和相册原图链接仍可使用。

## 验证

```sh
npx playwright install chromium  # CI/Linux 首次运行浏览器测试需要
npm run check
npm run test:stage1
npm run test:stage2
npm run test:stage3
npm run test:stage4
npm run test:stage5
npm test
```

浏览器测试优先使用本机 Chrome，也可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定路径。测试会先构建隔离的 `.test-dist/`，再测试生产页面；测试用长文、四条长短记和静音音轨在构建后自动清理。全套测试还会创建临时网站目录、实际运行 `npm ci`，验证示例启动、自定义设置、空栏目及内容隔离。

静态设计源在 `docs/design/`。截图、测试报告和测量数据生成在 `artifacts/`、`playwright-report/`，不进入公开模板。五阶段验收记录见 [开发验收](docs/VERIFICATION.md)。

## 发布

把 `dist/` 发布到支持静态网站的托管服务，或在 Vercel 使用构建命令 `npm run build`、输出目录 `dist`。需要私有内容仓库时，通过部署环境设置 `CONTENT_REPO`，并配置只读凭据 `CONTENT_SSH_KEY` 或 `CONTENT_REPO_TOKEN`。不要把凭据提交进仓库。该实现没有执行线上发布。

模板沿用 Astro Cactus 的内容与工具基础，保留原有许可和致谢。新增示例文字、图标与插画随本仓库许可证提供。

文章分类使用双语 `series`，在内容目录的 `site/series.json` 集中维护名称及翻译；文章不再填写 `tags`。具体格式与历史链接兼容见 [内容指南](docs/CONTENT.md)。

皮肤的配色与外观在各自的 `src/skins/<id>/` 内维护，详见 [皮肤维护](docs/SKINS.md)。

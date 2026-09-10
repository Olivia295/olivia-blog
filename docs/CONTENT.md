# 内容与同步指南

网站目录存放程序，独立内容目录存放你的真实分享。同步只从内容目录流向网站；任何生成副本都可能在下次同步时被替换。

## 文章

`blog/slug/index.md` 或 `index.mdx`，同目录放图片／音频。文件夹名成为文章地址，请在分享链接后保持稳定。

```yaml
---
title: 一段新的航程
description: 这篇文章的简短介绍。
publishDate: 2026-09-10
updatedDate: 2026-09-11
draft: false
series: 日常航行
music: false
---
```

`title`、`description`、`publishDate` 必填。`updatedDate` 可选，用于文章更新记录；首页两组内容均按 `publishDate` 从新到旧排序。正文使用 Markdown；`##`、`###` 自动组成目录。日期必须有效。

文章只使用 `series` 分类，不再填写 `tags`；短记的 `tags` 不受影响。可写单个中文名称，也可写 `series: [日常航行, 旅途]`。在 `site/series.json` 集中维护双语名称，数组顺序就是栏目顺序：

```json
[
  { "id": "daily-voyages", "zh": "日常航行", "en": "Daily Voyages" },
  { "id": "journeys", "zh": "旅途", "en": "Journeys", "aliases": ["旧系列名"], "legacyTags": ["travel"] }
]
```

`id` 用于稳定的筛选地址，发布后保留；`zh` / `en` 是界面名称。改名时把旧名加入 `aliases`；`legacyTags` 保留旧 `/tags/…/` 和 `/blogs/tags/…/` 的入口。已发布文章里使用的系列才会显示。尚未登记的新系列会原名显示，补上词表即可获得双语名称。旧的字符串排序数组仍能读取。重复或有歧义的名称、缺失翻译会在构建时明确报错。

`![描述](image.jpg)` 会对应复制到公开媒体目录，也支持 `images/view.jpg` 等子目录。媒体不允许用 `../` 越出文章目录。文章之间或相册之间的链接保持原样，例如 `[相关相册](/zh/gallery/trip/)`；英文导航对应 `/en/`。

如果文章同目录有音频且没有显式 `music` 字段，同步会加入播放器配置，但不会自动播放。写 `music: false` 可关闭。也可写 `music: { src: ./song.mp3, title: 航行配乐 }`；建议使用 YAML 多行格式。

## 动态

`post/slug/index.md`。必填 `publishDate`，使用含时区的完整时间，例如 `publishDate: "2026-09-10T18:30:00+10:00"`（保留引号）。`title`、`description`、`tags`、`draft` 可选。正文可以包含照片和相关长文链接。

只有 `post/` 的新内容源会被识别为动态，不会被误当成长文。旧版 `post/` 长文、`note/` 短记布局需要显式设置 `content.legacy: true` 或 `CONTENT_LEGACY=1`。

## 相册

`gallery/folder/` 中放图片和 `album.json`：

```json
{
  "slug": "trip",
  "title": "旅途中的光",
  "description": "一些想要留下来的风景。",
  "updatedDate": "2026-09-10T18:00:00+10:00",
  "order": 1,
  "photoDetails": {
    "01.jpg": { "alt": "海边步道尽头的灯塔" }
  }
}
```

相册名称唯一且不能包含路径分隔符。图片按文件名排序。`updatedDate` 保留相册更新时间元数据；首页不再混入相册条目。没有日期时，Git 内容仓库会采用该相册最近一次提交时间。仍无可靠日期则不显示日期，不使用本次构建时间冒充更新。

没有手填图片描述时，会使用“相册名 · 序号”提供基础可访问名称；有具体描述更好。同步会读取 EXIF 旋转后的尺寸，生成宽度最多 1000 像素的 WebP 预览，保留原图用于照片浏览器。支持 JPG、PNG、WebP、AVIF、GIF 和可信 SVG。亦保留 `gallery/photos.json` 的清单式接入，图片路径应指向公开可访问的地址。

## 个人资料

集中设置在 `site/site.json`。完整示例见网站的 `sample/site/site.json`。关于页头像放在 `site/about.jpg`；首页右侧图片放在 `site/home-hero.jpg`（也支持 JPEG、PNG、WebP、AVIF 和可信 SVG），保留原始比例和完整画面。首页图片与关于头像各自独立，不互相替代。可选的 `site/hangar.webp`／JPG／PNG／AVIF 替换停机舱背景；不提供时使用模板内的通用场景。标志放在 `site/logo.svg` 或 `logo.png`，图标放在 `site/icon.svg`；没有图片时使用模板自带的中性素材。

旧的 `site/about.json`、`site/copy.json`、`site/series.json` 仍兼容。新设置中的 `profile` 覆盖旧关于资料，`intro` 覆盖旧首页简介。社交链接使用完整 `https://` 或 `mailto:` 地址，`links: []` 可清空。

首页默认展示 3 条最新短记、5 篇最新文章，可在 `home.notes`、`home.articles` 调整。`home.portraitAlt` 提供中英文图片说明，`scene.motion` 控制窗景动效。短记正文预览在构建时提取，保留全文入口；照片只预览首张，数量链接可进入完整短记。

## 替换规则

- `blog/`、`post/`、`tag/`、`site/` 是权威来源，缺失或清空会清除相应生成副本。
- 相册删除后，清单与公开图片副本同步清除。
- 同步先准备、检查所有新内容，再替换生成目录。无效路径、错误 JSON、非法相册名和媒体路径会导致失败。
- 不修改源目录，不复制 `.git`、编辑器垃圾或凭据缓存。
- `CONTENT_MODE=sample` 明确切换到示例，并隔离个人身份；恢复个人内容时运行正常 `npm run dev` 或 `npm run build`。
- `BARE=1` 仅预览中性空外壳。个人资料也不会显示。

不要在网站的 `src/content/` 写新文章。那是同步生成目录，重建时不保留独立修改。

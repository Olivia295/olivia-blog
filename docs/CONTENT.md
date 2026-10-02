# 内容与同步指南

网站目录存放程序，独立内容目录存放你的真实分享。同步只从内容目录流向网站；任何生成副本都可能在下次同步时被替换。

## 从写作到发布

1. **选择内容类型。** 长文复制内容库的 `templates/文章.md` 到 `blog/新的英文短名/index.md`；快录、分享或摘抄选择对应随记模板，复制到 `post/新的英文短名/index.md`。模板目录本身不会同步。
2. **选择系列并写作。** 文章优先填最具体的子系列，父级自动包含；随记只填分类、时间和正文，不填外层标题或简介。替换模板中的日期，图片和音频放在新文件同目录。
3. **预览草稿。** 保留 `draft: true`，在网站目录运行 `npm run dev`，它会先同步外部内容。打开本地「文章」或「随记」页查看草稿；首页和 RSS 始终排除草稿。
4. **同步后续修改。** 服务运行期间改了外部内容，在网站目录的另一个终端运行 `npm run content:sync`，再刷新页面。改了 `site/` 配置后重启开发服务；同步后仍显示旧内容时也可重启。
5. **发布。** 检查正文、分类、来源、图片和实际日期，将这一篇改为 `draft: false` 并再次同步。推送内容仓库后重新部署网站才会更新线上；本地预览不是线上发布。

## 文章

`blog/slug/index.md` 或 `index.mdx`，同目录放图片／音频。文件夹名成为文章地址，请在分享链接后保持稳定。

```yaml
---
title: 一段新的航程
description: 这篇文章的简短介绍。
publishDate: 2026-09-10
updatedDate: 2026-09-11
draft: true
series: 体育交流
music: false
---
```

`title`、`description`、`publishDate` 必填。`updatedDate` 可选，用于文章更新记录；首页最近文章按 `publishDate` 从新到旧排序。正文使用 Markdown；`##`、`###` 自动组成目录。日期必须有效。

文章只使用 `series` 分类，不再填写 `tags`；随记的 `tags` 不受影响。通常只填最具体的子系列，例如 `series: 体育交流`，它会自动归入「具身详记」，无需重复填父级。跨主题文章可写多个系列，例如回忆录前言的 `series: [枢纽宝典, 时代回忆录]`。

当前个人内容库的选择如下；其他内容库可以在自己的 `site/series.json` 定义名称：

| 顶层系列   | 子系列                                 |
| ---------- | -------------------------------------- |
| 枢纽宝典   | 无，直接填写顶层名称                   |
| 时代回忆录 | 冷冰时代、绿玉时代、秀木时代、黄金时代 |
| 从灵探讨   | 无，直接填写顶层名称                   |
| 胡言乱想   | 无，直接填写顶层名称                   |
| 具身详记   | 书影音评论、游戏评测、体育交流         |

讨论整个系列的文章可以直接归到父级；具体的时代或评测文章优先选子级。父栏目包含自己与后代系列的文章，同一篇只计一次。子栏目不混入父级专属文章或相邻系列。登记但还没有文章的系列也会保留入口和空状态，不需要写占位内容。

`site/series.json` 集中维护双语名称和层级，同级按数组中的顺序展示，父级在子级之前：

```json
[
	{
		"id": "embodied-records",
		"zh": "具身详记",
		"en": "Embodied Records",
		"description": {
			"zh": "记录亲身体验与思考。",
			"en": "Personal experiences and reflections."
		}
	},
	{
		"id": "sports-discussion",
		"zh": "体育交流",
		"en": "Sports Discussion",
		"parent": "embodied-records"
	}
]
```

`id` 用于稳定的筛选地址，发布后保留；`zh` / `en` 是界面名称。子项的 `parent` 填父项的 `id`，不能填显示名称，不能指向自己或形成循环。改名时可把旧名加入 `aliases`；`legacyTags` 可保留旧 `/tags/…/` 和 `/blogs/tags/…/` 的入口，没有旧地址时可省略。

新增系列先登记再使用。尚未登记的名称仍可原名显示，但没有翻译和父子关系。旧的字符串排序数组仍能读取。重复或有歧义的名称、缺失翻译、无效父级和循环关系会在构建时明确报错。

`description` 是可选的系列导读，按 `zh` / `en` 分别填写，在对应语言的文章列表中显示。没有填写的语言不显示介绍；不需要为此创建额外文章。

`![描述](image.jpg)` 会对应复制到公开媒体目录，也支持 `images/view.jpg` 等子目录。媒体不允许用 `../` 越出文章目录。文章之间或相册之间的链接保持原样，例如 `[相关相册](/zh/gallery/trip/)`；英文导航对应 `/en/`。

MDX 变量或组件输出的媒体地址请使用站内绝对路径（如 `/post/my-note/photo.jpg`）；普通 Markdown 的本地相对图片仍会自动处理。

如果文章同目录有音频且没有显式 `music` 字段，同步会加入播放器配置，但不会自动播放。写 `music: false` 可关闭。也可写 `music: { src: ./song.mp3, title: 航行配乐 }`；建议使用 YAML 多行格式。

## 随记

`post/slug/index.md`。必填 `publishDate`，使用含时区的完整时间，例如 `publishDate: "2026-09-26T18:30:00+10:00"`（保留引号，并替换成实际时间）。`tags`、`draft` 可选；新写作建议先设 `draft: true`。正文可以包含照片和相关长文链接。

快录、分享与摘抄不再填写外层 `title`、`description`；旧内容中的这两个字段会被忽略。页面直接显示正文，RSS 的标题与摘要由作品名称或实际正文生成，不需要重复维护。正文中的 Markdown 标题正常保留。作品名称必须填写在 `recommendation.title`，摘抄直接从正文引用开始。

只有 `post/` 的新内容源会被识别为随记，不会被误当成长文。旧版 `post/` 长文、`note/` 短记布局需要显式设置 `content.legacy: true` 或 `CONTENT_LEGACY=1`。

随记全文直接展示在 `/zh/posts/`（英文 `/en/posts/`），从主导航「随记」或首页「全部随记」进入。快录、分享、摘抄是当前列表内的筛选按钮，不进入分类子页面，也不需要点开单条详情。首页正文提供最近随记的简短预览，个人介绍区不重复展示。首页预览、列表和 RSS 共用同一份内容；预览中的「查看随记」、分享与 RSS 使用 `#post-slug` 定位完整列表里的这条随记，发布后保持文件夹名 `slug` 稳定。旧分类及详情地址会转到当前列表。

内容库的 `templates/` 提供「文章.md」「随记-快录.md」「随记-分享.md」「随记-摘抄.md」。按本指南开头的流程复制、预览，再发布；新文章复制到 `blog/`，新随记复制到 `post/`。

内容库的 `post/example-quick-note/index.md`、`post/example-share/index.md`、`post/example-excerpt/index.md` 已是内容文件，可继续编辑。以其中的真实正文和日期为准，不把它们当成固定日期的演示；新写作优先使用模板。

### 音乐、书籍与电影推荐

在随记的 YAML 头部增加 `recommendation`，一条随记推荐一个作品。以下字段都写在 `recommendation` 内，正文仍写你的推荐理由；未填写它的普通随记、照片与摘抄继续按原方式显示。

| 字段      | 填写方式                                                                                     |
| --------- | -------------------------------------------------------------------------------------------- |
| `kind`    | 必填：音乐用 `music`，书籍用 `book`，电影用 `movie`                                          |
| `title`   | 必填：作品名称，即 `recommendation.title`；随记不填写外层 `title`                            |
| `url`     | 必填：音乐的收听链接，或书／影的 Wiki、官网等资料链接，使用完整 `https://` 或 `http://` 地址 |
| `creator` | 可选：歌手、作者或导演等署名                                                                 |
| `cover`   | 可选：封面／海报图片，支持同目录相对路径、站内绝对路径或完整图片链接；手填封面优先           |
| `audio`   | 仅音乐可选：可直接播放的音频文件路径或链接，如 `./song.mp3`；不填 Spotify 页面链接           |

例如下面是音乐推荐的填写模板，将作品信息和链接替换成真实内容；没有封面、署名或音频文件时，删去对应的可选字段即可：

```yaml
---
publishDate: "2026-09-23T18:30:00+10:00"
draft: true
recommendation:
  kind: music
  title: 歌曲名称
  url: https://open.spotify.com/track/your-track-id
  creator: 歌手名称
  cover: ./cover.jpg
  audio: ./song.mp3
---
在这里写下你为什么喜欢它。
```

书籍或电影使用同样的格式，把 `kind` 改成 `book` 或 `movie`，填写作品名称与资料链接，并去掉 `audio`。封面、海报保持完整比例。作品名称、作者和推荐文字由你填写，网站不自动替换这些内容。

Spotify 分享链接（`open.spotify.com` 或 `spotify.link`）显示「在 Spotify 收听」，点击后前往 Spotify，不嵌入播放器或加载 Spotify 脚本。音乐未填写 `cover` 时，网站会在构建时通过 [Spotify 官方 oEmbed 接口](https://developer.spotify.com/documentation/embeds/reference/oembed) 获取完整 `https://open.spotify.com/track/…` 或 `/album/…` 链接的封面；带 `intl-…` 语言前缀或分享参数也可识别。同一作品在一次构建中只请求一次，超时或获取失败仍会保留作品文字与外链，页面不再额外请求元数据。`spotify.link` 短链请换成打开后的完整单曲／专辑链接，或手填 `cover`。手填封面始终优先，也可用本地图片避免依赖远端封面加载。

只有填写音频文件时才显示原生播放器，需访客主动点击播放；Spotify 页面链接本身不会变成播放器。音频不可用时会保留说明、文件链接和平台入口。首页显示简洁推荐卡片；完整卡片与音频文件播放器显示在随记列表。

作品推荐自动归入「分享」分类。普通内容使用 `tags: [快录]`、`tags: [分享]` 或 `tags: [摘抄]`；旧「随记」「推荐」标签仍兼容。三种筛选按钮始终保留，空分类会显示提示。「分享」筛选地址为 `/zh/posts/?type=rec`（英文 `/en/posts/?type=rec`）；关于页不再单列「我的喜欢」入口。相对媒体路径应留在这条随记目录内，不使用 `../`。

## RSS 订阅

页脚的订阅入口进入 `/zh/subscribe/`，英文为 `/en/subscribe/`。页面提供说明和「复制订阅地址」，访客把完整地址粘贴到自己的 RSS 阅读器即可：

| 订阅内容             | 中文入口路径        | 英文入口路径        |
| -------------------- | ------------------- | ------------------- |
| 文章＋随记总订阅     | `/zh/feed.xml`      | `/en/feed.xml`      |
| 仅文章（保留原地址） | `/zh/rss.xml`       | `/en/rss.xml`       |
| 仅随记（保留原地址） | `/zh/posts/rss.xml` | `/en/posts/rss.xml` |

选择总订阅后不需要再订阅两条分类源。两种语言入口提供相同的原文内容，区别是导航及订阅说明语言，不会自动翻译文章。RSS 包含全文、图片、推荐信息与链接；播放器等交互内容提供文件或网站链接，`draft: true` 的内容不进入订阅。相册没有独立订阅，要介绍新相册时发布一条带相册链接的随记即可。

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

`description` 只显示在整本相册的照片上方；单张照片下方与大图弹窗不显示图注，`photoDetails.alt` 继续供读屏软件使用。

当前内容库的具体编辑位置是 `gallery/GunjouBiyori/album.json`（群青日和）、`gallery/KodakFilms/album.json` 和 `gallery/BnWFilms/album.json`。这三个文件的 `description` 已补入可改写的中性介绍，修改该字段即可替换整本相册的说明。

相册名称唯一且不能包含路径分隔符。图片按文件名排序。`updatedDate` 保留相册更新时间元数据；首页不再混入相册条目。没有日期时，Git 内容仓库会采用该相册最近一次提交时间。仍无可靠日期则不显示日期，不使用本次构建时间冒充更新。

没有手填图片描述时，会使用“相册名 · 序号”提供基础可访问名称；有具体描述更好。同步会读取 EXIF 旋转后的尺寸，生成宽度最多 1000 像素的 WebP 预览，保留原图用于照片浏览器。支持 JPG、PNG、WebP、AVIF、GIF 和可信 SVG。亦保留 `gallery/photos.json` 的清单式接入，图片路径应指向公开可访问的地址。

## 个人资料

集中设置在 `site/site.json`。完整示例见网站的 `sample/site/site.json`。关于页头像放在 `site/about.jpg`；首页右侧图片放在 `site/home-hero.jpg`（也支持 JPEG、PNG、WebP、AVIF 和可信 SVG），保留原始比例和完整画面。首页图片与关于头像各自独立，不互相替代。可选的 `site/hangar.webp`／JPG／PNG／AVIF 替换停机舱背景；不提供时使用模板内的通用场景。标志放在 `site/logo.svg` 或 `logo.png`，图标放在 `site/icon.svg`；没有图片时使用模板自带的中性素材。

旧的 `site/about.json`、`site/copy.json` 仍兼容。新设置中的 `profile` 覆盖旧关于资料，`intro` 覆盖旧首页简介；文章系列仍集中在 `site/series.json`，不需要迁移到 `site.json`。社交链接使用完整 `https://` 或 `mailto:` 地址，`links: []` 可清空。

### 分享的网站与链接

关于页的「另外的枢纽」使用 `links` 展示你自己的账号；下方「推荐前往」使用 `sharedLinks` 展示你想分享的网站。两组分别维护，留空数组 `[]` 或未填写 `sharedLinks` 时，不显示推荐栏目。

当前内容放在独立内容目录的 `site/about.json`，可以在顶层加入以下字段（这条链接来自已有分享）：

```json
"sharedLinks": [
  {
    "id": "TheNicestPlace",
    "label": "The Nicest Place",
    "href": "https://thenicestplace.net/",
    "icon": "mdi:cards-heart"
  }
]
```

添加网站只需再加一个对象，填写稳定的 `id`、显示名称 `label` 和完整网址 `href`；`icon` 可省略，默认显示链接图标。这个数组不影响随记里的音乐、书籍和电影推荐。

如果统一使用 `site/site.json`，把相同数组放在 `profile.sharedLinks`。当两个文件都填写时，`site/site.json` 的 `profile.sharedLinks` 优先，并完整替换旧数组；写 `[]` 会清空。请编辑独立内容目录，不修改网站内的生成副本。

首页上方展示个人介绍，下方左侧是最近随记、右侧是最近文章，窄屏改为上下排列。两组分别按 `publishDate` 从新到旧排序，默认最多 3 条随记和 5 篇文章，可用 `home.notes`、`home.articles` 调整；草稿不显示。随记预览包含正文摘要、分类、日期和首张照片，「查看随记」定位完整列表；多张照片会提供数量链接。`sections.posts`、`sections.blogs` 控制对应栏目，配合 `sections.hideEmpty` 隐藏空栏目；只剩一栏时自动占满，不保留空白栏位。

`home.portraitAlt` 提供中英文图片说明，`scene.motion` 控制窗景动效。随记全文、完整照片浏览和音频播放器都在「随记」页访问；首页个人介绍区不再重复显示一条最新随记。

首页大标题第一行由 `home.greeting.zh`、`home.greeting.en` 控制，例如 `"home": { "greeting": { "zh": "欢迎光临，我是", "en": "Hello, I’m" } }`。仅覆盖一种语言时，另一种沿用模板默认文案；旧配置不填写此字段仍可正常使用。第二行姓名沿用 `profile.name`（兼容 `site/about.json` 的 `name`），换行及装饰圆点保持原样。所有皮肤共用这些文字，内容按纯文本显示。

## 替换规则

- `blog/`、`post/`、`tag/`、`site/` 是权威来源，缺失或清空会清除相应生成副本。
- 相册删除后，清单与公开图片副本同步清除。
- 同步先准备、检查所有新内容，再替换生成目录。无效路径、错误 JSON、非法相册名和媒体路径会导致失败。
- 不修改源目录，不复制 `.git`、编辑器垃圾或凭据缓存。
- `CONTENT_MODE=sample` 明确切换到示例，并隔离个人身份；恢复个人内容时运行正常 `npm run dev` 或 `npm run build`。
- `BARE=1` 仅预览中性空外壳。个人资料也不会显示。

不要在网站的 `src/content/` 写新文章。那是同步生成目录，重建时不保留独立修改。

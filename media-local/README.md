# 本地媒体镜像（不进 git）

大文件请放这里，或上传到 **Vercel Blob** 后把公开 URL 写进：

- `src/data/music.json`
- `src/data/photos.json`

## 本地开发

1. 把 MP3 放到 `media-local/music/`，命名：`艺术家 - 歌名.mp3`
2. 把照片放到 `media-local/photos/<album-slug>/`
3. 用任意静态服务托管本目录，例如：

```bash
npx serve media-local -p 4322
```

4. 在 `.env` 中设置：

```
PUBLIC_MEDIA_BASE_URL=http://localhost:4322
```

5. 清单里用相对路径，例如：

```json
{ "artist": "Odesza", "title": "A Moment Apart", "src": "music/Odesza - A Moment Apart.mp3" }
```

## 上传到 Vercel Blob

```bash
# 需要 BLOB_READ_WRITE_TOKEN
npx vercel blob put media-local/music/your-track.mp3 --public
```

把返回的 URL 填进 JSON 清单即可（绝对 URL 不依赖 `PUBLIC_MEDIA_BASE_URL`）。

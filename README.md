# NoY

Static site for [noywear.com](https://noywear.com). Garden Studio lives at `garden-studio.html`.

## Garden wall

Visitors draw on the garden paper, then **hang the piece**.

- **My pieces** is saved in this browser (`localStorage`). Opening one puts it back on the paper. No account and no server.
- **Garden wall** (`garden-studio.html#garden-wall`) is the shared gallery, newest first. It stays a private, on-this-browser wall until the two public values in `assets/garden-config.js` are filled in.

Contact on the page is unchanged: zhaojinxiu0525@gmail.com · 15993986893. There is no checkout.

### See every piece that was hung

After the setup below, open:

**https://noywear.com/garden-studio.html#garden-wall**

That is the same wall visitors see. To hide one piece, set `published` to `false` on that row in Supabase → Table Editor → `garden_pieces`. The file itself stays in Storage → `garden-pieces` until you delete it there. Unpublished rows do not show on the site. The anon key cannot update or delete.

Before this is connected, each visitor’s pieces exist only in the browser they used. Refreshing the wall from another device will not show them yet.

### Connect Supabase (free)

1. Create a project at [supabase.com](https://supabase.com). The free plan is enough.
2. SQL Editor → New query → paste `garden-wall.sql` → Run.
3. Project Settings → API. Copy the **Project URL** and the **anon** or **publishable** key.
4. Paste them into `assets/garden-config.js`:

```js
window.NOY_GARDEN_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR-ANON-OR-PUBLISHABLE-KEY",
  bucket: "garden-pieces"
};
```

5. Commit that file and let GitHub Pages publish it.

Use only the anon / publishable key. The studio refuses a `service_role` or secret key if one is pasted by mistake. Those keys bypass the rules in `garden-wall.sql` and must not be committed.

The rules allow a visitor to add a JPEG and to read rows with `published = true`. They do not allow editing or deleting. Each image is a compressed JPEG under about 0.5 MB.

### 花园墙（给店主）

作品挂上之后，你看全部公开作品的地址是：

**https://noywear.com/garden-studio.html#garden-wall**

第一次需要按上面的步骤，把 Supabase 的项目网址和 anon / publishable key 填进 `assets/garden-config.js`。不要填写 service_role 或 secret key。想从墙上拿下一幅，在 Supabase 表格 `garden_pieces` 里把那一行的 `published` 改成 `false`。

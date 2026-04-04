# Corry 教练工作日历 — GitHub Pages 静态版

一个纯静态的单页应用，直接从 Outlook iCal 链接读取日历数据，展示小时粒度的忙碌/空闲状态。

## 文件说明

只有一个文件：`index.html`，包含所有 HTML、CSS 和 JavaScript，无需任何构建工具。

## 部署到 GitHub Pages（5 分钟）

### 第一步：修改 iCal 链接

打开 `index.html`，找到第 ~190 行的配置区域：

```javascript
const ICAL_URL = "https://outlook.live.com/owa/calendar/.../calendar.ics";
```

替换为你自己的 Outlook iCal 链接。

**如何获取 iCal 链接：**
1. 打开 https://outlook.live.com，登录账户
2. 点击左下角日历图标
3. 左侧"我的日历" → 点击 **"..."** 三点菜单
4. 选择 **"共享日历"**
5. 在"发布日历"区域，选择权限"只显示忙碌/空闲"，点击发布
6. 复制 **ICS** 格式链接

### 第二步：创建 GitHub 仓库

1. 登录 https://github.com，点击右上角 **"+"** → **"New repository"**
2. 仓库名称建议：`calendar` 或 `corry-calendar`
3. 选择 **Public**（GitHub Pages 免费版需要公开仓库）
4. 点击 **"Create repository"**

### 第三步：上传文件

方法 A（网页操作）：
1. 在仓库页面点击 **"Add file"** → **"Upload files"**
2. 拖入 `index.html`，点击 **"Commit changes"**

方法 B（命令行）：
```bash
git init
git add index.html
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/calendar.git
git push -u origin main
```

### 第四步：开启 GitHub Pages

1. 进入仓库 → **Settings** → 左侧 **Pages**
2. Source 选择 **"Deploy from a branch"**
3. Branch 选择 **main**，目录选 **/ (root)**
4. 点击 **Save**
5. 等待约 1 分钟，页面顶部会显示你的网址：`https://你的用户名.github.io/calendar/`

### 第五步（可选）：绑定自定义域名

1. 在仓库根目录创建文件 `CNAME`，内容为你的域名（如 `calendar.corryzhou.com`）
2. 在腾讯云 DNS 添加 CNAME 记录：
   - 主机记录：`calendar`
   - 记录类型：`CNAME`
   - 记录值：`你的用户名.github.io`
3. 在 GitHub Pages 设置中填入自定义域名，勾选 **Enforce HTTPS**

---

## 关于 CORS 代理

浏览器出于安全限制，无法直接跨域请求 Outlook 的 iCal 链接。本页面使用了 [corsproxy.io](https://corsproxy.io) 作为免费 CORS 代理。

如果 corsproxy.io 不稳定，可以替换为其他代理：
```javascript
// 在 index.html 中修改这一行：
const CORS_PROXY = "https://corsproxy.io/?url=";

// 备用代理选项：
// const CORS_PROXY = "https://api.allorigins.win/raw?url=";
// const CORS_PROXY = "https://cors-anywhere.herokuapp.com/";
```

---

## 数据说明

- **已预定**（红色）：Outlook 日历中该时段有任何事项，无论 Outlook 内部标记为忙碌还是空闲
- **空闲**（空白）：该时段在 Outlook 日历中没有任何事项
- 显示范围：每天 7:00–23:00，北京时间（UTC+8）
- 月份范围：过去 2 个月到未来 6 个月

# Outlook 日历 API 配置指南

本文档将指导你在 Microsoft Azure 上注册应用，获取连接 Outlook 日历所需的凭证，并完成授权配置。整个过程大约需要 10 分钟，无需编程知识。

---

## 前置条件

在开始之前，请确认你拥有以下条件：

| 条件 | 说明 |
|------|------|
| Microsoft 账户 | 你的 Outlook/Hotmail/Office 365 邮箱账户 |
| Azure 门户访问权限 | 使用同一 Microsoft 账户登录 [Azure 门户](https://portal.azure.com)（免费） |

> **注意**：Azure 门户本身是免费的，注册应用不收费。你不需要 Azure 付费订阅。

---

## 第一步：登录 Azure 门户

打开浏览器，访问 **https://portal.azure.com** ，使用你的 Microsoft 账户登录。如果你从未使用过 Azure，系统可能会要求你完成一个简短的初始设置，按提示操作即可。

---

## 第二步：注册新应用

1. 在 Azure 门户顶部的搜索栏中，输入 **"应用注册"**（或英文 **"App registrations"**），然后点击搜索结果中的 **"应用注册"** 服务。

2. 点击页面顶部的 **"+ 新注册"**（或 **"+ New registration"**）按钮。

3. 填写注册表单：

| 字段 | 填写内容 |
|------|----------|
| **名称** | 填写一个你能识别的名字，例如 `我的日历可用性` |
| **受支持的帐户类型** | 选择 **"任何组织目录中的帐户和个人 Microsoft 帐户"**（即 "Accounts in any organizational directory and personal Microsoft accounts"） |
| **重定向 URI** | 平台选择 **"Web"**，URI 填写你的应用回调地址（见下方说明） |

**关于重定向 URI**：这个地址是 Microsoft 授权完成后跳转回你应用的地址。格式为：

```
https://你的域名/api/outlook/callback
```

例如，如果你的应用部署在 `https://my-calendar.manus.space`，则填写：

```
https://my-calendar.manus.space/api/outlook/callback
```

如果你在本地开发测试，可以先填写：

```
http://localhost:3000/api/outlook/callback
```

> **提示**：你可以之后随时回来修改或添加更多重定向 URI。

4. 点击 **"注册"** 按钮完成创建。

---

## 第三步：获取 Client ID（客户端 ID）

注册完成后，你会被自动跳转到应用的概览页面。在这个页面上，你可以看到：

- **应用程序(客户端) ID**（Application (client) ID）

这就是你需要的 **Client ID**。它是一串类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` 格式的字符串。请复制并保存这个值。

---

## 第四步：创建 Client Secret（客户端密钥）

1. 在应用页面的左侧菜单中，点击 **"证书和密码"**（或 **"Certificates & secrets"**）。

2. 点击 **"+ 新客户端密码"**（或 **"+ New client secret"**）。

3. 填写描述（例如 `calendar-app-secret`），选择过期时间（建议选择 **24 个月**），然后点击 **"添加"**。

4. 密钥创建后，你会看到一个 **"值"**（Value）列。**立即复制这个值**，这就是你的 **Client Secret**。

> **重要警告**：这个密钥值只会显示一次！离开页面后将无法再次查看。如果忘记复制，需要删除旧密钥并重新创建一个新的。

---

## 第五步：确认 API 权限

1. 在左侧菜单中，点击 **"API 权限"**（或 **"API permissions"**）。

2. 确认列表中已有以下权限（通常默认已添加 `User.Read`）：

| 权限名称 | 类型 | 说明 |
|----------|------|------|
| `User.Read` | 委派 | 读取用户基本信息（默认已有） |
| `Calendars.Read` | 委派 | 读取用户日历事件 |

3. 如果没有 `Calendars.Read`，点击 **"+ 添加权限"** → 选择 **"Microsoft Graph"** → 选择 **"委派的权限"** → 搜索 `Calendars.Read` → 勾选并点击 **"添加权限"**。

> **说明**：本应用只需要 `Calendars.Read`（只读权限），不需要写入权限，这确保了应用无法修改你的日历。

---

## 第六步：将凭证填入应用

你现在应该有两个值：

| 名称 | 示例格式 | 在哪里获取 |
|------|----------|-----------|
| **OUTLOOK_CLIENT_ID** | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` | 应用概览页 → 应用程序(客户端) ID |
| **OUTLOOK_CLIENT_SECRET** | `AbC~dEf.gHi_jKl...` | 证书和密码页 → 客户端密钥的"值" |

将这两个值填入应用的环境变量配置中。在应用的管理界面（Settings → Secrets）中添加：

- 变量名 `OUTLOOK_CLIENT_ID`，值为你的客户端 ID
- 变量名 `OUTLOOK_CLIENT_SECRET`，值为你的客户端密钥

---

## 第七步：在应用中完成授权

1. 环境变量配置完成后，访问你的应用管理页面：`https://你的域名/admin`

2. 使用你的账户登录后，点击 **"连接 Microsoft 账户"** 按钮。

3. 系统会跳转到 Microsoft 登录页面，使用你的 Outlook 账户登录并授权。

4. 授权成功后，页面会自动跳转回管理页面，并显示"已连接"状态。

5. 现在访问首页，你的日历空闲/忙碌状态就会显示出来了。

---

## 常见问题

**Q：授权后显示错误怎么办？**

请检查重定向 URI 是否与你在 Azure 中配置的完全一致（包括 https/http、域名、路径）。

**Q：密钥过期了怎么办？**

回到 Azure 门户 → 你的应用 → 证书和密码，创建一个新密钥，然后更新应用中的 `OUTLOOK_CLIENT_SECRET` 环境变量。

**Q：可以使用公司/学校的 Office 365 账户吗？**

可以，前提是你的 IT 管理员允许用户授权第三方应用。如果遇到"需要管理员批准"的提示，请联系你的 IT 管理员。

**Q：这个应用能看到我的日历内容吗？**

应用后端在调用 Microsoft API 时，只请求 `start`、`end`、`showAs` 三个字段，从不请求事件标题、描述、参与者等任何内容。前端只能看到每小时是"忙碌"还是"空闲"。

---

## 安全说明

本应用在隐私保护方面采取了以下措施：

1. **最小权限原则**：仅申请 `Calendars.Read` 只读权限，无法修改日历
2. **数据最小化**：API 调用时使用 `$select=start,end,showAs` 参数，从源头限制返回字段
3. **服务端过滤**：日历数据在服务端处理，前端 API 只返回布尔值（忙/闲）
4. **Token 安全存储**：OAuth Token 存储在服务端数据库中，前端无法访问
5. **自动刷新**：Access Token 在过期前自动刷新，无需手动干预

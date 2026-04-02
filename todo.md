# Outlook 可用性日历 - TODO

## 后端
- [ ] 数据库 Schema：outlook_tokens 表（存储 OAuth token）
- [ ] Outlook OAuth 授权流程（/api/outlook/auth, /api/outlook/callback）
- [ ] tRPC 过程：calendar.getAvailability（按日期范围返回空闲/忙碌状态）
- [ ] tRPC 过程：calendar.getWeekAvailability（周视图数据）
- [ ] tRPC 过程：outlook.getAuthUrl（获取 Outlook 授权链接，仅 owner 使用）
- [ ] tRPC 过程：outlook.getAuthStatus（检查是否已授权）
- [ ] 隐私过滤层：后端只返回时间段状态，不暴露事项名称/详情
- [ ] Token 自动刷新机制

## 前端
- [ ] 全局样式：精致编辑美学（米色背景、Didone 衬线字体、大量留白）
- [ ] 周视图日历组件（小时粒度，空闲/忙碌颜色区分）
- [ ] 月视图日历组件（每天忙碌程度概览）
- [ ] 日期导航（前/后周、前/后月切换）
- [ ] 视图切换（周/月）
- [ ] 图例说明（空闲/忙碌颜色说明）
- [ ] Owner 管理页面（连接 Outlook 账户入口）
- [ ] 加载状态和空状态处理

## 文档
- [ ] Azure 应用注册配置说明文档
- [ ] 环境变量配置说明

## 管理页面改造
- [x] 后端添加 admin.verifyPassword 和 admin.validateToken tRPC 接口
- [x] 前端 Admin 页面改为密码输入框，不再依赖 Manus OAuth
- [x] 密码通过 ADMIN_PASSWORD 环境变量配置，HMAC 保护
- [x] 密码验证成功后用 sessionStorage 保存状态
- [x] 改为 iCal 方案，移除 Azure OAuth 依赖
- [x] ICAL_URL 和 ADMIN_PASSWORD 环境变量已配置
- [x] 全部 13 个测试通过

## 测试
- [ ] 后端 API 单元测试（availability 过程）

## UI 改进（用户反馈）
- [x] 缩小行高，让整体更紧凑
- [x] 空闲时段去掉绿色背景，保持空白
- [x] 忙碌时段保留红色，格子内显示"已预定"文字
- [x] 改为以月为单位的横向视图，支持左右拖拽滚动
- [x] 左侧时间标签改为区间格式（7–8、8–9、9–10）
- [x] 全天事件标记 7–23 点为忙碌，7 点以前不显示

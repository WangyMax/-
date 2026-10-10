# FitCustom Pro 个人专属健身记录 App

针对个人力量健美训练四分化循环场景深度定制的轻量级、高效率移动端健身记录应用。

---

## 🌟 核心特性
- **经典四分化循环预设**：胸➕三头（+20m有氧）、背➕二头（+20m有氧）、肩➕腹部（+20m有氧）、腿部专注（0有氧）；
- **专业跑架式递减超级组（Drop Sets）**：支持大组自定义（默认4大组），每大组包含独立多阶梯递减重量与次数；
- **真实器械灵活计量**：全面支持 `重量(kg)`、`插销(片)`、`单滑轮(1:1)`、`双滑轮(2:1)`、`助力` 与 `自重`；
- **一键完全休息日打卡**：支持打卡完全休息（Rest Day），保障身体超量恢复并完整串联训练周期；
- **体重与生活日记**：记录每日体重与饮食笔记，配合 SVG 矢量平滑波动曲线（支持周视图/月视图）；
- **Android 原生端适配**：通过 Capacitor 打包，针对全面屏手机预留顶部安全距离，避免与状态栏重合；
- **云端自动化构建**：代码推送至 GitHub main 分支即自动通过 GitHub Actions 编译生成 Android APK 并发布直链。

---

## 🛠️ 技术栈
- **框架**：React 18 + TypeScript + Vite
- **样式**：Tailwind CSS + Lucide Icons
- **移动端容器**：Capacitor 6 (Android)
- **CI/CD**：GitHub Actions (Ubuntu + Java 21 + Gradle)

---

## 📖 开发者文档
更详细的系统架构、数据模型设计思路与避坑指南，请查阅 [DEVELOPMENT_HANDBOOK.md](./DEVELOPMENT_HANDBOOK.md)。

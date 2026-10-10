# FitCustom Pro (个人专属健身记录 App) - 架构设计与开发思路全景手册

> **致 ZCODE 开发者与维护者**：
> 本文档记录了本项目的完整设计思路、业务规则、数据模型、避坑经验与工程流水线，旨在让你可以零成本无缝接盘，持续迭代与维护。

---

## 一、 项目背景与业务核心诉求

### 1. 训练分化体系（四分化循环 + 完全休息）
项目基于用户的真实健身训练日程打造，遵循经典的大肌群 + 小肌群分化循环：
1. **胸 ➕ 三头**（练后附加 20 分钟坡度快走有氧）
2. **背 ➕ 二头**（练后附加 20 分钟坡度快走有氧）
3. **肩 ➕ 腹部**（练后附加 20 分钟坡度快走有氧）
4. **腿部专注 (深蹲日)**（体力消耗极大，专注下肢力量，默认无有氧）
5. **完全休息日 (Rest Day)**（生理超量恢复，一键打卡，无多余输入，保证打卡周期不中断）

### 2. 真实器械计量适配（核心痛点）
健身房器械并非只有单一的杠铃哑铃重量：
- **重量 (kg)**：自由重量或标重器械；
- **插销片数 (片)**：龙门架或固定插销器械，用户往往只记插了几片；
- **滑轮比例 (Pulley Ratio)**：单滑轮 (1:1) 与双滑轮 (2:1)，在不同健身房发力手感不同，系统支持标明；
- **助力 / 自重**：如助力引体向上、自重深蹲。

---

## 二、 核心功能架构与数据模型设计

### 1. 递减超级组系统（Drop Sets / 跑架式超级组）
这是本项目最核心的专业级创新功能，位于 `src/types/index.ts`、`src/components/WorkoutView.tsx`、`src/components/PlansView.tsx`：
- **结构定义**：采用 **大组 (Round) ➔ 内部多阶连续递减重量与独立次数 (DropStage)** 树形结构；
- **数据模型**：
  ```ts
  export interface DropStage {
    id: string;
    weightOrPlates: number; // 阶梯重量/片数
    unit: ResistanceUnit;
    reps: number;           // 该阶梯完成次数
  }

  export interface WorkoutSet {
    id: string;
    setNumber: number;      // 第几大组（如第 1 大组、第 2 大组）
    unit: ResistanceUnit;
    weightOrPlates: number;
    reps: number;
    completed: boolean;     // 大组完成状态
    isDropSet?: boolean;    // 是否开启超级组
    dropStages?: DropStage[]; // 大组内的各个阶梯详情
  }
  ```
- **典型真实案例（10.08 肩部超级组飞鸟）**：
  - 一共有 4 个大组（大组数量可自由自定义增减）；
  - 每一大组内连续从 10kg 递减到 2.5kg：
    - `#1`: 10kg × 12次 ➔ `#2`: 7.5kg × 12次 ➔ `#3`: 5kg × 10次 ➔ `#4`: 2.5kg × 12次
  - 每个阶梯的重量与次数均有独立步进器，支持自由点击【+ 加一个递减重量】追加阶段；做完整个递减流程后打勾完成该大组。

### 2. 本地持久化与防数据复活机制（重要排坑经验）
位于 `src/utils/storage.ts`：
- **纯本地优先**：数据 100% 存储在客户端 `localStorage`，无外部网络依赖，地下室健身房弱网秒开；
- **防复活原则（曾踩坑点）**：
  - 历史内置数据（10.06 - 10.09 真实训练）仅在初次无数据时写入一次；
  - **严禁在 `getSessions()` 或 `getWeightLogs()` 中编写“检测缺少预置数据就自动补齐”的代码**，否则用户在前端点击删除某天后，页面一刷新就会被自动复活！当前版本已彻底根治此问题，删除即为永久删除。

### 3. 极简化与纯粹记录原则（防闪退经验）
- **不要引入危险的 Android 前台后台 Service**：
  - 移动端在 Android 14+ / Android 15 对后台 `ForegroundService` 限制极严；
  - 组数打勾（`toggleSetComplete`）严格保持为**纯同步的本地内存与 localStorage 状态翻转**，绝不调用任何未经用户授权的系统级服务，保证 100% 零闪退、零延迟。

### 4. 界面 UI 与移动端视口适配
- **全面屏状态栏避让垫片**：
  - 在 `src/App.tsx` 顶部配有专门的避让垫片：
    `<div className="h-[max(env(safe-area-inset-top),38px)] w-full shrink-0 bg-slate-50" />`
    确保任何挖孔屏、水滴屏手机打开后，页面标题都不会与系统时间、5G、电量图标重叠。
- **开练底栏 50/50 对称布局**：
  - 位于 `WorkoutView.tsx` 底部，使用 `grid grid-cols-2 gap-3`，左侧【放弃本次训练】与右侧【结束并保存记录】严格各占 50%，触控面积舒适。
- **SVG 贝塞尔平滑波动曲线**：
  - 位于 `src/components/WeightJournalView.tsx`，完全使用原生 SVG 三次贝塞尔曲线（Cubic Bézier）绘制，带渐变阴影与数据点气泡；
  - 联动支持【周视图 (近7天)】、【月视图 (近30天)】与【全部】三档无缝切换。

---

## 三、 工程结构目录速查

```
健身应用程序/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # GitHub Actions 云端自动构建打包工作流
├── android/                       # Capacitor Android 原生容器工程
│   ├── app/
│   │   ├── build.gradle           # 原生编译配置（版本号 versionCode/versionName、签名配置）
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # 原生清单文件
│   │       └── java/com/fitcustom/pro/MainActivity.java # 原生入口
├── src/
│   ├── components/
│   │   ├── WorkoutView.tsx        # 今日训练主看板、开练面板、超级组专属面板
│   │   ├── PlansView.tsx          # 训练计划管理、编辑弹窗、动作负荷预设
│   │   ├── ExerciseLibraryView.tsx # 标准动作库、部位筛选、动作搜索、收藏
│   │   └── WeightJournalView.tsx  # 日志记录中心、历史训练折叠手风琴、SVG走势曲线
│   ├── data/
│   │   ├── initialExercises.ts    # 预置官方完整动作库字典
│   │   └── initialPlans.ts        # 预置四大循环分化计划（含预设重量与超级组）
│   ├── types/
│   │   └── index.ts               # TypeScript 核心数据接口定义
│   ├── utils/
│   │   └── storage.ts             # 数据持久化封装、版本迁移、备份导出导入
│   ├── App.tsx                    # 主视图容器、顶部安全垫片、磨砂底部导航
│   └── main.tsx                   # 前端挂载入口
├── capacitor.config.ts            # Capacitor 移动端配置文件
├── package.json                   # 依赖与脚本定义
├── tailwind.config.js             # 视觉原子化样式配置
├── vite.config.ts                 # Vite 打包配置
└── DEVELOPMENT_HANDBOOK.md        # 本手册
```

---

## 四、 后续开发与日常维护工作流

在 ZCODE 中打开本目录后，日常维护只需使用以下标准命令：

### 1. 本地启动与调试
```bash
# 启动本地快速预览
npm run dev

# 浏览器打开 http://localhost:5173
```

### 2. 编译与 Android 原生同步
修改任何前端代码后，运行：
```bash
# 1. 执行 TypeScript 校验与生产编译
npm run build

# 2. 将编译产物同步到 android/ 原生工程
npx cap sync android
```

### 3. 一键发布新版本并自动生成 APK
当你完成功能改动并准备出新安装包时：
1. **递增版本号**：
   - 打开 `android/app/build.gradle`，将 `versionCode` 增加 1，将 `versionName` 设为新版本（如 `"2.3"`）；
   - 打开 `.github/workflows/build-apk.yml`，将 `tag_name` 设为相应版本（如 `v2.3.0`）；
2. **提交并推送代码**：
   ```bash
   git add -A
   git commit -m "feat: 你的更新说明"
   git push origin main
   ```
3. **获取安装包**：
   - GitHub Actions 会自动在云端完成打包；
   - 约 1.5 分钟后，可在 GitHub Releases 页面直接获取公开的直链下载：
     `https://github.com/WangyMax/-/releases`
     手机浏览器点开直接下载，免登录、免解压！

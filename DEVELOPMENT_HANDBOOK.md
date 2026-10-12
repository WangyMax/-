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
  - 确保任何挖孔屏、水滴屏手机打开后，页面标题都不会与系统时间、5G、电量图标重叠。
- **开练底栏 50/50 对称布局**：
  - 位于 `WorkoutView.tsx` 底部，使用 `grid grid-cols-2 gap-3`，左侧【放弃本次训练】与右侧【结束并保存记录】严格各占 50%，触控面积舒适。
- **SVG 贝塞尔平滑波动曲线**：
  - 位于 `src/components/WeightJournalView.tsx`，完全使用原生 SVG 三次贝塞尔曲线（Cubic Bézier）绘制，带渐变阴影与数据点气泡；
  - 联动支持【周视图 (近7天)】、【月视图 (近30天)】与【全部】三档无缝切换。

### 5. 统一会话构建器（修复计划页开练丢超级组）
位置：`src/utils/sessionBuilder.ts`（v2.3 新增）
- **踩坑背景**：「今日训练」页的 `startPlan` 与「计划分化」页 App.tsx 里的 `handleStartPlanFromPlansTab` 曾是**两份各自维护的内联构造代码**。计划页那份漏掉了 `isDropSet / dropStages` 处理——从计划页开练「肩 ➕ 腹部」超级组计划时，递减阶梯会整体丢失，变成普通组。
- **铁律**：**同一个业务动作只允许存在一份构造逻辑**。两条开练入口统一调用：
  ```ts
  buildSessionFromPlan(plan: WorkoutPlan, allExercises: Exercise[]): WorkoutSession
  ```
  内部处理：预设单位/滑轮回退、上次训练数据智能预填、超级组阶梯深拷贝注入（计划预设优先，其次上次训练，最后默认 10→7.5→5→2.5kg 四阶）。
- **维护约定**：日后修改开练预填规则只改 `sessionBuilder.ts`，**严禁**在任何组件里再写内联的会话构造代码。

### 6. localStorage 解析缓存与 React 引用语义（v2.3 重要避坑）
位置：`src/utils/storage.ts` 顶部 `cache` 对象
- **踩坑背景**：训练页曾在**渲染函数体里**每次渲染调用 `getSessions()`，全量 `JSON.parse`；打字改备注时每按一次按键触发一次重渲染，5 个动作就要解析数十遍全量历史。现已改为：`get*` 首次解析后写入进程内缓存，后续读取零 parse；`save*` 写穿（localStorage + 缓存同步更新）。
- **核心避坑（差点翻车点）——React setState 引用语义**：
  - 项目里大量「mutate → save → `setState(StorageService.get*())`」的刷新模式；
  - React 的 `setState` 收到**与当前 state 相同的对象引用**时会静默 bail-out，**不重渲染**；
  - 若 `save*` 把调用方传入的**同一数组引用**写回缓存，`get*` 返回同一引用 → setState 失效 → 打卡后界面完全不动（旧版每次 `JSON.parse` 都返回新引用，所以碰巧正常，缓存上线后此问题立即暴露）；
  - **因此所有 `save*` 必须缓存浅拷贝**：`cache.xxx = [...list];`（当前代码有注释标注，勿删）。
- **另外两条配套约定**：
  - `restoreOfficialData()` / `resetAllData()` 直接 `setItem/removeItem` 绕过了 `save*`，**必须手动同步或清空缓存**（当前代码已处理）；
  - `importBackupJson()` 内部走 `save*`，自动继承缓存更新，无需额外处理。
- **改缓存相关代码时三查**：① 新写入路径是否更新了缓存；② 是否浅拷贝（防引用 bail-out）；③ restore/reset 是否同步。

### 7. 渲染路径零 IO 原则（v2.3 性能基线）
- **任何组件的渲染函数体内禁止调用 `StorageService.get*`**：数据一律进 React state，变更时显式刷新（先 `StorageService.addSession/deleteSession` 再 `setSessions(StorageService.getSessions())`）。
- **「上次训练参考」用一次扫描建 Map**：`WorkoutView` 中用 `useMemo` 把 sessions 扫成 `Map<exerciseId, 最近完成日志>`，替代原先每张动作卡片各自全量查找（O(N×M) → O(N)）。语义与 `getLastExerciseLog` 完全一致：按日期降序取首个含已完成组的命中。
- 休息日打卡横幅读的是 **sessions** 不是 plans——刷新横幅务必 `setSessions`，早期版本误写成 `setPlans` 导致打卡后横幅不出现，已修复。

### 8. 本地日期铁律：v2.4 UTC 时区 bug 排坑
- **踩坑背景**：`new Date().toISOString().split('T')[0]` 取的是 UTC 日期。北京时间（UTC+8）下每天 0:00–8:00 返回的是**前一天**（已用节点脚本演示验证：模拟 10-11 早7点取到 10-10）。影响面：休息日横幅匹配、训练归档日期、体重打卡默认日期、备份文件名。
- **铁律**：所有“今天是几号”场景必须调 `src/utils/date.ts` 的 `todayLocalDate()`，**禁止**再写 `toISOString().split('T')` 取日期。唯一例外是 `exportBackupJson` 的 `exportedAt` 时间戳——那里要的就是 UTC ISO 格式，正确无误。
- **同期验证后刻意不动的东西**（防止后人盲改）：
  - `浮点精度`：曾怀疑 `updateSetField ±2.5` 会累积误差，验证后推翻—2.5 是二进制精确表示，任意有限小数加减在 double 精度内无可见误差。
  - `window.confirm ×3` + `alert ×4`：存量的全是用户点击后同步触发，没有真机复现证据证明会被 WebView 拦截，保持现状。若日后真机复现拦截，参照 WeightJournalView 内建确认弹窗的方式替换。
  - `toggleFavorite / updateExerciseUnit / resetAllData` 暂无 UI 调用，但是数据层 API 集合的正常成员，留着无害不删。
  - `restType / rpe` 类型字段暂无消费，纯类型声明零运行时成本，不动类型定义。
  - `VIBRATE` 权限声明在 Manifest 里残留（JS 层零调用、原生源码零残留，删流体云功能时漏删）——无害声明，下次动原生层时顺手清理。

### 9. APK 固定签名铁律：v2.5 覆盖安装保数据
- **踩坑背景**：GitHub Actions 每次用全新虚拟机 + 临时 debug 签名打包，每版签名都不同。Android 规定签名不同的同包名 APK 不能覆盖安装，用户只能卸载重装，卸载会清空 localStorage——用户 10-09 之后的体重与休息日数据因此失夺。
- **修法**：仓库内固定 keystore（`android/fitcustom.keystore`，密码 `fitcustom`，有效期 30 年）+ `android/key.properties` 写死配置并提交，`app/build.gradle` 的 debug/release 均用该签名。CI 无需额外配置，每次打包签名自动一致。
- **铁律**：**绝不更换或删除 keystore**；CI 签名配置不得删除；每次发版后验证新旧包签名证书指纹一致。从 v2.5 起所有版本支持直接覆盖安装，手机本地数据无缝保留。
- **备注**：v2.5 与旧版签名不同，需最后一次卸载重装；之后永不再需要卸载。

### 10. 休息日补签功能（v2.6 新增）
- 位置：WorkoutView “今日完全休息”下方的“之前漏打卡了？”行。选过去某天日期点“补签休息”即可。
- 规则：只能补今天之前的日期（输入框 max 限制 + handler 双重校验）；当天已有任何训练/休息记录则拒绝重复补签。提示用页内文字，不依赖原生弹窗。
- 补签记录的 notes 标为“完全休息（补签）”，便于在历史里区分。

### 11. 数字输入框可清空原则（v2.7 修复）
- **踩坑背景**：受控 `type="number"` 输入框若写 `value={数字}` + `onChange={parseInt(v) || 1}`，用户清空时空字符串 parse 出 NaN 立刻被 `|| 1` 填回 1——“12次”只能删掉 2，1 永远留着。
- **铁律**：所有数字输入框必须允许清空——`value={数字 || ''}`，onChange 判断 `e.target.value === ''` 时写 0/undefined 而不是默认值。校验后移到保存/结算时清洗（见 PlansView handleSavePlan 的 sanitized 逻辑）。
- 涉及面：计划编辑的目标组数/次数/预设负荷、超级组阶梯重量/次数，训练记录的每组重量/次数与阶梯值。

### 12. v2.8 界面烕新架构（专注模式 + 历史与体重创意升级）
- **专注模式**：WorkoutView 开练后一屏只显示一个动作（focusIdx 切换），通过 onFocusModeChange 通知 App 隐藏底部导航防误触；右下角悬浮“结束”钮进底部确认抽屉归档。所有训练数据操作逻辑与 v2.7 完全一致，只收纳界面。
- **分化罗盘**：顶部“胸➔背➔肩➔腿➔休”横条，按历史记录推断上次分化与建议下次，只是建议不强制。今日状态卡把开练/休息/补签合成三段切换。
- **规格胶囊 + 大组行**：单位/滑轮 7 个按钮收成 1 个胶囊，点开底部抽屉修改；组行整行可点打钩，按钮 44px。超级组默认折叠一行摘要，有氧/备注默认折叠（腿日自动隐藏有氧）。
- **训练历史**：统计条（累计/本周/连续打卡/总组数）、近8周活动日历（点格子过滤）、每场容量与用时、类型筛选。容量/统计计算在 `src/utils/stats.ts`，纯函数无侧效。
- **体重记录**：目标体重（`WEIGHT_GOAL` 键，进备份）+曲线目标虚线、趋势洞察横幅（近7天均值对比）、近6周打卡日历、时段过滤。
- **统一确认抽屉**：`src/components/ConfirmSheet.tsx`，代替全应用 window.confirm/alert（现已清零）。新增确认场景必须用它。
- **动效基线**：index.css 的 fade-in/sheet-up/check-pop/card-in 纯 CSS 动效，不依赖任何原生服务（手册第 3 节铁律不动）。

### 13. v2.8.2 删除确认框被底部导航遮挡修复
- **踩坑背景**：用户手机上点历史训练删除，确认抽屉弹出来但取消/确认删除按钮被底部导航盖住，只能看到标题描述。原因是底部导航与全部弹窗抽屉同为 z-50，后渲染的导航在同一层级盖住了抽屉按钮（用户截图证实）。
- **修法**：全部底部弹窗提到 z-[70]（ConfirmSheet、PlansView 新建/编辑与挑选动作、WorkoutView 规格/加动作/完成祝贺、ExerciseLibraryView 新增动作），底部导航保持 z-50；ConfirmSheet 弹层底边加 `env(safe-area-inset-bottom)` 安全区。
- **验证**：390×844 手机视口下删除确认框完整可见，确认删除按钮在最上层可点，点确认后记录删除；npm run build 通过。注意桌面预览点击曾受自动化后端状态影响，结论以 DOM 几何测量与截图为准。

### 14. v2.8.3 历史可改 + 动作归位 + 单侧记录
- **问题① 历史记录可编辑**：日志页训练卡片展开态加编辑入口，弹窗可改每组重量/次数（含单侧左右）、删组、改训练与动作备注，保存走 `addSession` 同 id 写回并刷新；休息日仅备注可改。验证：隔离记录 60kg 改 65kg 保存后同 id 写回，容量同步更新。
- **问题② 自定义动作归位**：`addCustomExercise` 由 `unshift` 置顶改为同部位分组末尾插入；`getExercises` 两条路径稳定归一化（部位顺序→内置优先→原顺序）；动作库列表按部位分组渲染组头。验证：新建肱三头单侧动作后位于肱三头分组末尾（数组 idx 39/49），带用户自建与左右独立徽标及编辑/删除按钮。
- **问题③ 每个动作可标单侧**：`Exercise.isUnilateral`（动作库新增/编辑开关）→ `PlanExerciseTarget.isUnilateral`（计划页普通动作开关，超级组不提供）→ 开练 `ExerciseLog.isUnilateral` + 每组 `left/right` → 训练页左右两列分别记录 → 统计左右累加。单侧只做普通组，超级组阶梯不支持分侧。验证：单侧计划开练每组左右列正常，320px 下 scrollWidth 等于 clientWidth 无溢出。
- **数据红线**：无新增存储键，旧数据缺字段走原分支；弹窗保持 z-[70]；备份恢复逻辑不动。

### 15. v2.8.4 历史完整编辑
- **背景**：v2.8.3 的历史编辑只能改重量次数、删组、改备注，用户要求动作、组数、个数、重量、单双侧、名字都能改。
- **修法**：动作名改为可直接输入的文本框（仅改本条记录）；动作行加单双侧切换、换动作、删动作；组列表加“加一组”；列表底部加“新增动作”；换动作与新增动作共用动作挑选弹窗（z-80，盖在编辑弹窗之上）。换动作保留组数与备注，重量次数沿用原组，单侧按新动作标记重建左右。
- **验证**：编辑弹窗展示改名框、单双侧切换、换动作、删动作、加一组、新增动作入口；tsc 与构建通过。

### 16. v2.8.5 历史单侧行对齐
- **背景**：历史编辑弹窗单侧两行中，左行有组号与单位后缀而右行没有，输入框错位（用户手机截图证实）。
- **修法**：两行统一为同一网格列（左右标签、重量、×、次数、单位），两侧输入框上下对齐。
- **验证**：390 视口截图确认左右两行对齐；tsc 与构建通过。

### 17. v2.8.6 记录改名 + 历史导入计划
- **记录改名**：历史编辑弹窗头部标题改为可编辑输入框，仅改本条记录的 `planName`，不影响计划库。验证：自由训练改名后同 id 写回，列表更新。
- **历史导入计划**：计划编辑页加“从过往训练导入”按钮，挑选非休息日历史记录后，用该场已完成组的重量次数生成计划预设（含单侧左右、超级组阶梯、有氧设置），替换当前动作编排。验证：导入后计划名带模板后缀，动作预设与历史一致。
- **数据红线**：导入为新建/编辑中的本地组装，不写历史；无新增存储键；弹窗层级 z-80 盖在编辑弹窗之上。

---

## 三、 工程结构目录速查

```
健身应用程序/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # GitHub Actions 云端自动构建打包工作流
├── android/
│   ├── fitcustom.keystore         # 固定签名密钥库（不可更换删除）
│   ├── key.properties             # 签名配置（密码 fitcustom，随仓库提交）
│   └── (Capacitor Android 原生容器工程)
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
│   │   ├── WeightJournalView.tsx  # 日志记录中心：统计+日历+容量+目标曲线
│   │   └── ConfirmSheet.tsx       # 全应用统一底部确认抽屉
│   ├── data/
│   │   ├── initialExercises.ts    # 预置官方完整动作库字典
│   │   └── initialPlans.ts        # 预置四大循环分化计划（含预设重量与超级组）
│   ├── types/
│   │   └── index.ts               # TypeScript 核心数据接口定义
│   ├── utils/
│   │   ├── sessionBuilder.ts      # 统一会话构建器：计划→进行中训练的唯一构造入口（含超级组阶梯注入）
│   │   ├── date.ts                # 本地日期工具：todayLocalDate，禁止再用 toISOString 取日期
│   │   ├── stats.ts               # 纯函数统计：容量/时长/连续打卡/周次数
│   │   └── storage.ts             # 数据持久化封装、进程内解析缓存、版本迁移、备份导出导入
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

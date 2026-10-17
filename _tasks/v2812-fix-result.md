# v2.8.12 修复结果（data-code 提交，待主模型审核）

## 结论

已完成三项修复：原生状态栏/刘海避让、移除恢复官方记录按钮、原生导出改为写 Cache 后系统分享并给出就近反馈。TypeScript 类型检查与生产构建均通过。

## 修改文件

1. `android/app/src/main/java/com/fitcustom/pro/MainActivity.java`
   - `onCreate` 中对 `android.R.id.content` 注册 `ViewCompat.setOnApplyWindowInsetsListener`。
   - 取 `WindowInsetsCompat.Type.systemBars()` 与 `Type.displayCutout()` 的 insets，逐边取 `Math.max` 设置 `paddingLeft/top/right`，`bottom` 固定为 0。
   - 返回 `WindowInsetsCompat.CONSUMED`。
2. `src/App.tsx` 第 39 行
   - 顶部垫片 `h-[max(env(safe-area-inset-top),46px)]` 改为 `h-[env(safe-area-inset-top)]`，避免原生避让后重复 46px。
3. `src/components/WeightJournalView.tsx`
   - 新增 `Capacitor`、`Filesystem/Directory/Encoding`、`Share`、`AlertCircle` 导入；移除不再使用的 `RotateCcw`。
   - 删除 `handleRestoreOfficialData` 函数（StorageService.restoreOfficialData 保留未动）。
   - 备份提示新增 `backupStatus` 状态（第 84 行）。
   - 新增 `showBackupStatus`（第 502 行）：写入提示并 5 秒后清空。
   - `handleExportBackup`（第 508 行）改为 async：
     - 原生端：`Filesystem.writeFile` 写 `Directory.Cache`、`Encoding.UTF8`、文件名 `fitcustom-backup-<todayLocalDate()>.json`；再 `Share.share({ url: written.uri, dialogTitle: '导出训练数据' })`。
       - 分享成功：`备份已生成，可在分享面板保存或发送`。
       - 分享 reject 且信息含 cancel：`已取消分享，备份文件仍已生成`。
       - 其他异常：`导出失败：<错误信息>`。
     - Web 端：保留 Blob + a.download 下载，成功提示 `备份已下载`，异常提示 `导出失败：<错误信息>`。
   - 备份卡片（第 1700-1741 行）：标题改为「本地数据中心与备份」，说明文案去掉恢复官方记录表述，网格由 `sm:grid-cols-3` 改为 `sm:grid-cols-2`，删除恢复按钮；新增就近提示条，成功为绿色边框、失败为红色边框。
   - 导入逻辑与 `importStatus` 顶部提示保持不变。

## 未修改确认

- 版本号未动：`android/app/build.gradle` versionCode 30 / versionName 2.8.11；`package.json` version 1.0.0。
- `package.json`、`package-lock.json`、发布工作流、存储键、其他原生文件均未由本任务修改（`git status` 中这两个文件为派发前已存在的 filesystem/share 依赖安装改动，内容仅新增两条 dependency）。
- `StorageService.restoreOfficialData`（storage.ts 第 848 行）与 `exportBackupJson`（第 863 行）保留；导出 JSON 结构未改。
- 其他页面中的 `max(env(safe-area-inset-top),46px)` 弹窗偏移未动（不属于本次指定范围）。

## 实际验证

在 `D:/Agent/Zcode/健身程序/FitCustomPro` 下执行：

- `npx tsc --noEmit`：通过（仅 npm 的 store-dir 警告，无类型错误）。
- `npm run build`：通过，1598 modules transformed，产物输出到 `dist/`。
- `grep -n "恢复 10.06\|handleRestoreOfficialData\|RotateCcw" src/components/WeightJournalView.tsx`：无匹配（exit 1）。
- `grep -n "Filesystem\|Share.share\|备份已生成\|已取消分享\|备份已下载\|导出失败" src/components/WeightJournalView.tsx`：均存在对应实现。
- `grep -n "h-\[env(safe-area-inset-top)\]" src/App.tsx`：第 39 行匹配。
- `tsconfig.json` 中 `noUnusedLocals`/`noUnusedParameters` 为 true，类型检查通过说明无遗留未使用符号。

## 未验证项与限制

- 未执行 Android Gradle 编译与真机安装（任务核验范围仅要求 tsc 与 build；无设备/模拟器条件）。
- 本地 `android/app/src/main/assets/capacitor.plugins.json` 当前为 `[]`，`android/capacitor.settings.gradle` 尚无 share/filesystem 条目，即本机尚未执行 `npx cap sync android`。发布工作流 `.github/workflows/build-apk.yml` 第 41 行在打包前会执行 `npx cap sync android`，届时两个插件会被注册；本任务按写入范围未运行 sync（会改动 android 其他原生文件），如本地直接打包需先执行 sync。
- 真机分享面板行为（取消分支、FileProvider 可用性）未在设备上实测；取消分支匹配 Share 插件 Android 源码中的 `"Share canceled"`（node_modules/@capacitor/share/.../SharePlugin.java 第 79 行），依据 Capacitor Filesystem 8.1.5 / Share 8.0.3 的类型定义与既定方案实现。
- 状态栏避让的实际像素效果需真机确认。补充说明：Capacitor 8 内置 `com.getcapacitor.plugin.SystemBars` 在 DecorView 上默认按 `insetsHandling = "css"` 处理，本实现把监听器加在其子视图 `android.R.id.content` 上；若 SystemBars 走 native 分支会先把 systemBars insets 归零，理论上不会与本实现叠加，但两者叠加后的实际顶距需真机核验。本任务未改 Capacitor 配置。

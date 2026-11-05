package com.fitcustom.pro;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * 用药模块用到的三件原生小事（Capacitor 官方插件覆盖不到）：
 *
 * 1. notificationsEnabled：直接问系统「本应用通知是否被允许」。
 *    比插件的运行时权限更接近真实结果（Android 13+ 运行时权限被永久拒绝、
 *    或 Android 12 及以下在系统设置里关掉通知，都只有这个 API 能看出来）。
 * 2. openNotificationSettings：跳到本应用的通知设置页。运行时权限被"永久拒绝"后
 *    系统不再弹窗，只能由用户手动打开，这是唯一的出路。
 * 3. openIcsFile：ACTION_VIEW + text/calendar 打开 .ics 文件，
 *    直接唤起系统日历的导入界面。比 ACTION_SEND 分享面板可靠：
 *    国内 ROM 的日历多数只注册 VIEW，不注册 SEND。
 */
@CapacitorPlugin(name = "MedicationNative")
public class MedicationNativePlugin extends Plugin {

    @PluginMethod
    public void notificationsEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            boolean enabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
            ret.put("enabled", enabled);
            ret.put("sdkInt", Build.VERSION.SDK_INT);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("check_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        boolean opened = false;
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            opened = true;
        } catch (Exception first) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", getContext().getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                opened = true;
            } catch (Exception second) {
                opened = false;
            }
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    @PluginMethod
    public void openIcsFile(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.isEmpty()) {
            call.reject("missing uri");
            return;
        }
        boolean opened = false;
        try {
            Uri uri = Uri.parse(uriString);
            if ("file".equals(uri.getScheme())) {
                String path = uri.getPath();
                if (path == null) {
                    throw new IllegalArgumentException("empty path");
                }
                uri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        new File(path)
                );
            }
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "text/calendar");
            // ClipData 里再带上一次 URI：部分 ROM 的日历只从 ClipData 取数据，
            // 且这样 FLAG_GRANT_READ_URI_PERMISSION 的授权更可靠
            intent.setClipData(ClipData.newRawUri("medication-ics", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            opened = true;
        } catch (Exception e) {
            opened = false;
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }
}

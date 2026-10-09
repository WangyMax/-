package com.fitcustom.pro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

public class RestTimerAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP, "fitcustom:alarm_receiver");
            wakeLock.acquire(10000L); // 唤醒 10 秒供震动提醒
        }

        try {
            // 1. 关屏幕/锁屏下的强烈连震提醒
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 500, 200, 500, 200, 1000};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1), attrs);
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }

            // 2. 伴随简短系统提醒音
            try {
                Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                if (alertUri == null) {
                    alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                }
                if (alertUri != null) {
                    Ringtone r = RingtoneManager.getRingtone(context, alertUri);
                    if (r != null) {
                        r.play();
                    }
                }
            } catch (Exception e) {
                // ignore
            }

            // 3. 通知前台服务倒计时已结束
            Intent stopIntent = new Intent(context, FluidMediaService.class);
            stopIntent.setAction("ACTION_REST_FINISHED");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(stopIntent);
            } else {
                context.startService(stopIntent);
            }

        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
}

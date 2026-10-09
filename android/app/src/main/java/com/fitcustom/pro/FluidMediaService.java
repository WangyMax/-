package com.fitcustom.pro;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.util.Locale;

public class FluidMediaService extends Service {

    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_STOP = "ACTION_STOP";
    public static final String ACTION_REST_FINISHED = "ACTION_REST_FINISHED";
    public static final String EXTRA_SECONDS = "EXTRA_SECONDS";

    private static final String CHANNEL_ID = "fitcustom_live_capsule";
    private static final int NOTIFICATION_ID = 2026;

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private AlarmManager alarmManager;
    private PowerManager.WakeLock wakeLock;
    private Handler handler;
    private Runnable updateTicker;

    private long targetEndTimeMs = 0;
    private int totalDurationSecs = 120;
    private PendingIntent alarmPendingIntent;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
        handler = new Handler(Looper.getMainLooper());
        createNotificationChannel();
        initMediaSession();
        acquireWakeLock();
    }

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "fitcustom:fluid_service_wakelock");
            wakeLock.acquire(130 * 1000L); // 最多锁定 130 秒覆盖两分钟
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "OPPO一加流体云组间胶囊",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("OPPO/一加系统状态栏与打孔屏原生流媒体倒计时胶囊");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            channel.setSound(null, null);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "FitCustomFluidCapsule");
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onStop() {
                stopSelf();
            }

            @Override
            public void onSkipToNext() {
                stopSelf();
            }
        });
        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START.equals(action)) {
                int secs = intent.getIntExtra(EXTRA_SECONDS, 120);
                startRestTimer(secs);
            } else if (ACTION_STOP.equals(action)) {
                stopRestTimer();
            } else if (ACTION_REST_FINISHED.equals(action)) {
                onRestFinished();
            }
        }
        return START_NOT_STICKY;
    }

    private void startRestTimer(int seconds) {
        this.totalDurationSecs = seconds;
        this.targetEndTimeMs = System.currentTimeMillis() + (seconds * 1000L);

        // 1. 设置系统精确闹钟，确保屏幕完全关闭/息屏锁屏时准时唤醒震动
        scheduleExactAlarm(this.targetEndTimeMs);

        // 2. 启动前台通知，打通 OPPO/一加 流体云
        Notification notification = buildMediaNotification(seconds, false);
        startForeground(NOTIFICATION_ID, notification);

        // 3. 启动每秒更新，确保系统胶囊上的时间实时递减
        startLiveUpdates();
    }

    private void scheduleExactAlarm(long triggerAtMs) {
        cancelExactAlarm();
        Intent i = new Intent(this, RestTimerAlarmReceiver.class);
        alarmPendingIntent = PendingIntent.getBroadcast(
                this,
                0,
                i,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        if (alarmManager != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, alarmPendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, alarmPendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMs, alarmPendingIntent);
            }
        }
    }

    private void cancelExactAlarm() {
        if (alarmManager != null && alarmPendingIntent != null) {
            alarmManager.cancel(alarmPendingIntent);
            alarmPendingIntent = null;
        }
    }

    private void startLiveUpdates() {
        if (updateTicker != null) {
            handler.removeCallbacks(updateTicker);
        }

        updateTicker = new Runnable() {
            @Override
            public void run() {
                long now = System.currentTimeMillis();
                long remainingMs = targetEndTimeMs - now;

                if (remainingMs <= 0) {
                    onRestFinished();
                } else {
                    int remainingSecs = (int) Math.ceil(remainingMs / 1000.0);
                    updateMediaSessionMetadata(remainingSecs);
                    Notification notification = buildMediaNotification(remainingSecs, false);
                    if (notificationManager != null) {
                        notificationManager.notify(NOTIFICATION_ID, notification);
                    }
                    handler.postDelayed(this, 1000);
                }
            }
        };

        handler.post(updateTicker);
    }

    private void updateMediaSessionMetadata(int remainingSecs) {
        if (mediaSession == null) return;

        int mins = remainingSecs / 60;
        int secs = remainingSecs % 60;
        String timeStr = String.format(Locale.getDefault(), "%02d:%02d", mins, secs);

        // 设置播放状态，使 ColorOS 识别为正在播放并常驻顶部打孔胶囊
        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
                .setState(PlaybackStateCompat.STATE_PLAYING, (totalDurationSecs - remainingSecs) * 1000L, 1.0f)
                .setActions(PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
                .build();
        mediaSession.setPlaybackState(state);

        // Title 直接显示倒计时时间，使 OPPO 胶囊中间直接呈现时间
        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, timeStr + " 组间休息")
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "FitCustom Pro 力量训练")
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "剩余时间: " + timeStr)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, totalDurationSecs * 1000L)
                .build();
        mediaSession.setMetadata(metadata);
    }

    private Notification buildMediaNotification(int remainingSecs, boolean finished) {
        int mins = remainingSecs / 60;
        int secs = remainingSecs % 60;
        String timeStr = String.format(Locale.getDefault(), "%02d:%02d", mins, secs);

        String title = finished ? "⚡ 休息结束，开练下一组！" : timeStr + " 组间间歇倒计时";
        String content = finished ? "请开始下一组力量输出" : "剩余 " + timeStr + " (目标 " + (totalDurationSecs / 60) + "分钟)";

        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(
                this, 0, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(content)
                .setSubText("FitCustom Pro")
                .setContentIntent(contentPending)
                .setOngoing(!finished)
                .setAutoCancel(finished)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(targetEndTimeMs);

        if (mediaSession != null && !finished) {
            builder.setStyle(new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0));
        }

        return builder.build();
    }

    private void onRestFinished() {
        if (updateTicker != null) {
            handler.removeCallbacks(updateTicker);
            updateTicker = null;
        }

        Notification finishedNotification = buildMediaNotification(0, true);
        if (notificationManager != null) {
            notificationManager.notify(NOTIFICATION_ID, finishedNotification);
        }

        handler.postDelayed(this::stopSelf, 3000);
    }

    private void stopRestTimer() {
        cancelExactAlarm();
        releaseWakeLock();
        if (updateTicker != null) {
            handler.removeCallbacks(updateTicker);
            updateTicker = null;
        }
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        cancelExactAlarm();
        releaseWakeLock();
        if (updateTicker != null) {
            handler.removeCallbacks(updateTicker);
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}

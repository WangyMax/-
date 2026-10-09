package com.fitcustom.pro;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "FluidMediaCapsule")
public class FluidMediaCapsulePlugin extends Plugin {

    private static final String CHANNEL_ID = "fitcustom_media_capsule";
    private static final int NOTIFICATION_ID = 2026;

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;
    private Handler timerHandler;
    private Runnable timerRunnable;
    private long targetEndTimeMs = 0;
    private int totalDurationSecs = 120;

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
        timerHandler = new Handler(Looper.getMainLooper());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "OPPO一加流体云组间胶囊",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("用于在OPPO/一加系统状态栏顶部显示原生流媒体间歇倒计时胶囊");
            channel.setShowBadge(false);
            channel.enableVibration(false);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        } else {
            notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        int seconds = call.getInt("seconds", 120);
        this.totalDurationSecs = seconds;
        this.targetEndTimeMs = System.currentTimeMillis() + (seconds * 1000L);

        timerHandler.post(() -> {
            initMediaSession();
            startCountdownLoop();
        });

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        timerHandler.post(this::cleanup);
        call.resolve();
    }

    private void initMediaSession() {
        if (mediaSession == null) {
            mediaSession = new MediaSessionCompat(getContext(), "FitCustomRestCapsule");
            mediaSession.setCallback(new MediaSessionCompat.Callback() {
                @Override
                public void onStop() {
                    cleanup();
                }

                @Override
                public void onSkipToNext() {
                    cleanup();
                }
            });
        }

        // 配置为正在播放状态，触发 ColorOS 系统流体云识别
        PlaybackStateCompat state = new PlaybackStateCompat.Builder()
                .setState(PlaybackStateCompat.STATE_PLAYING, 0, 1.0f)
                .setActions(PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP | PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
                .build();
        mediaSession.setPlaybackState(state);

        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, "组间间歇倒计时")
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "FitCustom Pro 力量训练")
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "OPPO流体云专属胶囊")
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, totalDurationSecs * 1000L)
                .build();
        mediaSession.setMetadata(metadata);

        mediaSession.setActive(true);
    }

    private void startCountdownLoop() {
        if (timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }

        timerRunnable = new Runnable() {
            @Override
            public void run() {
                long now = System.currentTimeMillis();
                long remainingMs = targetEndTimeMs - now;

                if (remainingMs <= 0) {
                    onTimerFinished();
                } else {
                    int remainingSecs = (int) Math.ceil(remainingMs / 1000.0);
                    updateCapsuleNotification(remainingSecs, false);
                    timerHandler.postDelayed(this, 1000);
                }
            }
        };

        timerHandler.post(timerRunnable);
    }

    private void updateCapsuleNotification(int remainingSecs, boolean finished) {
        if (notificationManager == null) return;

        int mins = remainingSecs / 60;
        int secs = remainingSecs % 60;
        String timeStr = String.format(Locale.getDefault(), "%02d:%02d", mins, secs);

        String title = finished ? "⚡ 休息结束，开练！" : "组间间歇倒计时 " + timeStr;
        String content = finished ? "请开始下一组力量输出" : "剩余时间: " + timeStr + " (目标 " + (totalDurationSecs / 60) + "分钟)";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(content)
                .setSubText("FitCustom Pro")
                .setOngoing(!finished)
                .setAutoCancel(finished)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        if (mediaSession != null && !finished) {
            builder.setStyle(new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0));
        }

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    private void onTimerFinished() {
        triggerHardwareVibration();
        updateCapsuleNotification(0, true);

        // 延迟 4 秒后自动释放流体云胶囊
        timerHandler.postDelayed(this::cleanup, 4000);
    }

    private void triggerHardwareVibration() {
        try {
            Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[]{0, 400, 150, 400, 150, 700};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception e) {
            // ignore
        }
    }

    private void cleanup() {
        if (timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
            timerRunnable = null;
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
        }
        if (notificationManager != null) {
            notificationManager.cancel(NOTIFICATION_ID);
        }
    }
}

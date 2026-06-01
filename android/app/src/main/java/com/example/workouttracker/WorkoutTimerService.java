package com.example.workouttracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.app.NotificationCompat;

public class WorkoutTimerService extends Service {

    public static final String CHANNEL_ID = "workeeto_timer_channel";
    public static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START = "ACTION_START";
    public static final String ACTION_PAUSE = "ACTION_PAUSE";
    public static final String ACTION_DONE = "ACTION_DONE";
    public static final String ACTION_STOP = "ACTION_STOP";

    public static final String EXTRA_WORKOUT_NAME = "workout_name";
    public static final String EXTRA_START_SECONDS = "start_seconds";

    public static final String BROADCAST_ACTION = "com.example.workouttracker.TIMER_ACTION";
    public static final String BROADCAST_EXTRA_ACTION = "action";
    public static final String BROADCAST_EXTRA_SECONDS = "elapsed_seconds";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable tickRunnable;
    private int elapsedSeconds = 0;
    private String workoutName = "Workout";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        if (action == null) action = ACTION_START;

        switch (action) {
            case ACTION_START:
                workoutName = intent.getStringExtra(EXTRA_WORKOUT_NAME);
                if (workoutName == null) workoutName = "Workout";
                elapsedSeconds = intent.getIntExtra(EXTRA_START_SECONDS, 0);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
                } else {
                    startForeground(NOTIFICATION_ID, buildNotification());
                }
                startTicking();
                break;

            case ACTION_PAUSE:
                stopTicking();
                broadcastAction("pause");
                stopForeground(true);
                stopSelf();
                break;

            case ACTION_DONE:
                stopTicking();
                broadcastAction("done");
                stopForeground(true);
                stopSelf();
                break;

            case ACTION_STOP:
                stopTicking();
                stopForeground(true);
                stopSelf();
                break;
        }

        return START_NOT_STICKY;
    }

    private void startTicking() {
        stopTicking();
        tickRunnable = new Runnable() {
            @Override
            public void run() {
                elapsedSeconds++;
                updateNotification();
                handler.postDelayed(this, 1000);
            }
        };
        handler.postDelayed(tickRunnable, 1000);
    }

    private void stopTicking() {
        if (tickRunnable != null) {
            handler.removeCallbacks(tickRunnable);
            tickRunnable = null;
        }
    }

    private void broadcastAction(String action) {
        Intent broadcastIntent = new Intent(BROADCAST_ACTION);
        broadcastIntent.putExtra(BROADCAST_EXTRA_ACTION, action);
        broadcastIntent.putExtra(BROADCAST_EXTRA_SECONDS, elapsedSeconds);
        sendBroadcast(broadcastIntent);
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Workout Timer",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Active workout timer");
        channel.setShowBadge(false);
        channel.enableVibration(false);
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent openAppPI = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent pauseIntent = new Intent(this, WorkoutTimerService.class);
        pauseIntent.setAction(ACTION_PAUSE);
        PendingIntent pausePI = PendingIntent.getService(
            this, 1, pauseIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent doneIntent = new Intent(this, WorkoutTimerService.class);
        doneIntent.setAction(ACTION_DONE);
        PendingIntent donePI = PendingIntent.getService(
            this, 2, doneIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(workoutName)
            .setContentText(formatTime(elapsedSeconds))
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(openAppPI)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .addAction(android.R.drawable.ic_media_pause, "Pause", pausePI)
            .addAction(android.R.drawable.ic_media_next, "Done", donePI)
            .build();
    }

    private void updateNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private String formatTime(int totalSeconds) {
        int h = totalSeconds / 3600;
        int m = (totalSeconds % 3600) / 60;
        int s = totalSeconds % 60;
        if (h > 0) {
            return String.format("%d:%02d:%02d", h, m, s);
        }
        return String.format("%02d:%02d", m, s);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopTicking();
        super.onDestroy();
    }
}

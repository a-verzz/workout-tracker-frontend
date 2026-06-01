package com.example.workouttracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WorkoutTimer")
public class WorkoutTimerPlugin extends Plugin {

    private BroadcastReceiver timerReceiver;

    @Override
    public void load() {
        timerReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getStringExtra(WorkoutTimerService.BROADCAST_EXTRA_ACTION);
                int elapsedSeconds = intent.getIntExtra(WorkoutTimerService.BROADCAST_EXTRA_SECONDS, 0);
                JSObject data = new JSObject();
                data.put("action", action != null ? action : "");
                data.put("elapsedSeconds", elapsedSeconds);
                notifyListeners("timerAction", data);
            }
        };

        IntentFilter filter = new IntentFilter(WorkoutTimerService.BROADCAST_ACTION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(timerReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(timerReceiver, filter);
        }
    }

    @PluginMethod
    public void startTimer(PluginCall call) {
        String workoutName = call.getString("name", "Workout");
        int startSeconds = call.getInt("seconds", 0);

        Intent serviceIntent = new Intent(getContext(), WorkoutTimerService.class);
        serviceIntent.setAction(WorkoutTimerService.ACTION_START);
        serviceIntent.putExtra(WorkoutTimerService.EXTRA_WORKOUT_NAME, workoutName);
        serviceIntent.putExtra(WorkoutTimerService.EXTRA_START_SECONDS, startSeconds);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), WorkoutTimerService.class);
        serviceIntent.setAction(WorkoutTimerService.ACTION_STOP);
        getContext().startService(serviceIntent);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (timerReceiver != null) {
            try {
                getContext().unregisterReceiver(timerReceiver);
            } catch (IllegalArgumentException ignored) {
            }
            timerReceiver = null;
        }
    }
}

package com.example.workouttracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutTimerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

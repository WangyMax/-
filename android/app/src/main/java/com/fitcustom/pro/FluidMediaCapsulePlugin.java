package com.fitcustom.pro;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FluidMediaCapsule")
public class FluidMediaCapsulePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        int seconds = call.getInt("seconds", 120);
        Context context = getContext();

        Intent intent = new Intent(context, FluidMediaService.class);
        intent.setAction(FluidMediaService.ACTION_START);
        intent.putExtra(FluidMediaService.EXTRA_SECONDS, seconds);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, FluidMediaService.class);
        intent.setAction(FluidMediaService.ACTION_STOP);

        context.startService(intent);
        call.resolve();
    }
}

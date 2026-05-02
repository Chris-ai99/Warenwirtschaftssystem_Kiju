package de.kiju.lager;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ScanBroadcastReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String barcode = MainActivity.extractBarcodeFromIntent(intent);
        if (barcode == null || barcode.isEmpty()) return;

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        launchIntent.putExtra(MainActivity.EXTRA_BARCODE, barcode);
        context.startActivity(launchIntent);
    }
}

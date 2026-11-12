package com.bilgiarena.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Build;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.view.Gravity;

/** OS protections are defense in depth, never evidence that a player is honest. */
public abstract class SecureActivity extends Activity {
    private View privacyCover;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        protect(getWindow());
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
    }

    static void protect(Window window) {
        if (window == null) return;
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        if (Build.VERSION.SDK_INT >= 31) window.setHideOverlayWindows(true);
    }

    protected AlertDialog secureDialog(AlertDialog.Builder builder) {
        AlertDialog dialog = builder.create();
        protect(dialog.getWindow());
        dialog.setOnShowListener(d -> protect(dialog.getWindow()));
        dialog.show();
        return dialog;
    }

    protected void coverScreen() {
        if (privacyCover != null && privacyCover.getParent() != null) return;
        privacyCover = null;
        TextView cover = new TextView(this);
        cover.setText("bilgiarena\n\nOyun ekranı gizlendi");
        cover.setTextSize(22);
        cover.setTextColor(0xff25282e);
        cover.setBackgroundColor(0xffa0d3d7);
        cover.setGravity(Gravity.CENTER);
        cover.setClickable(true);
        cover.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        privacyCover = cover;
        addContentView(cover, new FrameLayout.LayoutParams(-1, -1));
    }

    protected void uncoverScreen() {
        if (privacyCover != null && privacyCover.getParent() instanceof android.view.ViewGroup) {
            ((android.view.ViewGroup) privacyCover.getParent()).removeView(privacyCover);
        }
        privacyCover = null;
    }

    @Override protected void onPause() { coverScreen(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); uncoverScreen(); }

    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        int blockedFlags = MotionEvent.FLAG_WINDOW_IS_OBSCURED;
        if (Build.VERSION.SDK_INT >= 29) blockedFlags |= MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED;
        if ((event.getFlags() & blockedFlags) != 0) {
            onObscuredInput();
            return true;
        }
        return super.dispatchTouchEvent(event);
    }

    protected void onObscuredInput() { /* Input is dropped; do not label the user a cheater. */ }
}

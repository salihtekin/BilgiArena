package com.bilgiarena.app;
import android.content.SharedPreferences;
/** Opt-in crash COUNT only. Never stores Throwable details or intercepts recovery. */
public final class CrashDiagnostics implements Thread.UncaughtExceptionHandler {
 private final SharedPreferences prefs;
 private final Thread.UncaughtExceptionHandler previous;
 CrashDiagnostics(SharedPreferences prefs,Thread.UncaughtExceptionHandler previous){this.prefs=prefs;this.previous=previous;}
 public static void install(SharedPreferences prefs){var previous=Thread.getDefaultUncaughtExceptionHandler();if(previous!=null&&!(previous instanceof CrashDiagnostics))Thread.setDefaultUncaughtExceptionHandler(new CrashDiagnostics(prefs,previous));}
 @Override public void uncaughtException(Thread thread,Throwable failure){try{if(prefs.getBoolean("analyticsConsent",false)&&prefs.getBoolean("connected",false))prefs.edit().putInt("pendingCrashCount",Math.min(99,prefs.getInt("pendingCrashCount",0)+1)).commit();}catch(Exception ignored){}finally{previous.uncaughtException(thread,failure);}}
 public static void consent(SharedPreferences prefs,boolean enabled){var edit=prefs.edit().putBoolean("analyticsConsent",enabled);if(!enabled)edit.remove("pendingCrashCount");edit.apply();}
 public static int pending(SharedPreferences prefs){return prefs.getBoolean("analyticsConsent",false)?Math.min(99,Math.max(0,prefs.getInt("pendingCrashCount",0))):0;}
 public static void acknowledged(SharedPreferences prefs,int sent){int remaining=Math.max(0,prefs.getInt("pendingCrashCount",0)-sent);prefs.edit().putInt("pendingCrashCount",remaining).apply();}
}

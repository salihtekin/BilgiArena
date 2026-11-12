package com.bilgiarena.app;

import android.net.Uri;
import android.view.WindowManager;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.junit.Test;
import org.junit.Before;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
public class SecurityTest {
    @Before public void grantManifestPermission(){
        RuntimeEnvironment.getApplication().getSharedPreferences("arena",0).edit().putBoolean("onboarded",true).apply();
        for(String game:new String[]{"trivia","word","reverse","math","memory","colors"})RuntimeEnvironment.getApplication().getSharedPreferences("arena",0).edit().putBoolean("tutorial-"+game,true).apply();
        Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions("android.permission.HIDE_OVERLAY_WINDOWS");
    }
    @Test public void mainWindowIsSecureEvenBeforeAQuizStarts(){
        var activity=Robolectric.buildActivity(MainActivity.class).setup().get();
        assertTrue((activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_SECURE)!=0);
        assertNotNull(activity.findViewById(android.R.id.content));
    }
    @Test public void signInAllowsOnlyTrustedHttpsOrigins(){
        assertTrue(SignInActivity.allowed(Uri.parse(BuildConfig.ARENA_ORIGIN+"/callback")));
        assertTrue(SignInActivity.allowed(Uri.parse("https://chatgpt.com/auth/login")));
        assertFalse(SignInActivity.allowed(Uri.parse("http://chatgpt.com/auth/login")));
        assertFalse(SignInActivity.allowed(Uri.parse("https://chatgpt.com.attacker.invalid/")));
        assertFalse(SignInActivity.allowed(Uri.parse("https://attacker@chatgpt.com/")));
        assertFalse(SignInActivity.allowed(Uri.parse("file:///etc/passwd")));
        assertFalse(SignInActivity.allowed(Uri.parse("https://chatgpt.com:8080/")));
    }
    @Test public void backgroundingHidesTheQuestionAndReturningCannotRestoreItForPoints(){
        var controller=Robolectric.buildActivity(MainActivity.class).setup();
        var activity=controller.get();
        View start=findText(activity.getWindow().getDecorView(),"Oyna  →");
        assertNotNull(start);start.performClick();
        View practice=findText(activity.getWindow().getDecorView(),"Antrenman yap  →");assertNotNull(practice);practice.performClick();
        assertNotNull(findText(activity.getWindow().getDecorView(),"1 / 10"));
        controller.pause();
        assertNotNull(findText(activity.getWindow().getDecorView(),"bilgiarena\n\nOyun ekranı gizlendi"));
        controller.resume();
        assertNotNull(findText(activity.getWindow().getDecorView(),"Soru kesinti nedeniyle kapatıldı"));
        assertNotNull(findText(activity.getWindow().getDecorView(),"0 puan"));
        controller.pause().stop().destroy();
    }
    private static View findText(View view,String text){
        if(view instanceof TextView && ((TextView)view).getText().toString().equals(text))return view;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){View result=findText(group.getChildAt(i),text);if(result!=null)return result;}}
        return null;
    }
}

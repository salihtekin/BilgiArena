package com.bilgiarena.app;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.io.File;
import java.io.FileOutputStream;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35,qualifiers="w320dp-h800dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class NativeUiTest {
    @Before public void setup(){
        var app=RuntimeEnvironment.getApplication();
        app.getSharedPreferences("arena",0).edit().clear().putBoolean("onboarded",true).apply();
        for(String game:new String[]{"trivia","word","reverse","math","memory","colors"})app.getSharedPreferences("arena",0).edit().putBoolean("tutorial-"+game,true).apply();
        Shadows.shadowOf(app).grantPermissions("android.permission.HIDE_OVERLAY_WINDOWS");
    }
    @Test public void everyOfflineGameOpensThroughTheVisibleNativeControls() throws Exception {
        for(String game:new String[]{"Ters Köşe","Harf Harmanı","Hafıza İzi","Eksik Sayı","Renk Avı","Bilgi Arenası"}){
            var controller=Robolectric.buildActivity(MainActivity.class).setup();var activity=controller.get();
            findDescription(activity.getWindow().getDecorView(),"Oyunlar").performClick();
            View tile=findDescription(activity.getWindow().getDecorView(),game);assertNotNull(game,tile);tile.performClick();
            View play=findText(activity.getWindow().getDecorView(),"Antrenman yap  →");assertNotNull(play);play.performClick();
            View root=activity.getWindow().getDecorView();assertNotNull(findText(root,game));assertNotNull(findText(root,"1 / 10"));
            assertTrue(hasTimer(root));snapshot(root,game.replace(' ','-'));
            controller.pause().stop().destroy();
        }
    }
    @Test public void approvedHomeAndAccountEmptyStatesContainNoSampleMoney() throws Exception {
        var controller=Robolectric.buildActivity(MainActivity.class).setup();var activity=controller.get();View root=activity.getWindow().getDecorView();
        assertNotNull(findText(root,"Oyun zamanı."));snapshot(root,"home");
        findDescription(root,"Geçmiş").performClick();root=activity.getWindow().getDecorView();
        assertNotNull(findText(root,"İlk turunu tamamladığında burada göreceksin."));
        assertNull(findText(root,"1.000 TL"));snapshot(root,"history");
        findDescription(root,"Profil").performClick();root=activity.getWindow().getDecorView();assertNotNull(findText(root,"Oyuncu"));snapshot(root,"profile");
        controller.pause().stop().destroy();
    }
    @Test public void interruptedFinalKeepsCountingDownWithoutReceivingTheQuestionAgain() throws Exception {
        var controller=Robolectric.buildActivity(MainActivity.class).setup();var activity=controller.get();
        var accept=MainActivity.class.getDeclaredMethod("accept",org.json.JSONObject.class);accept.setAccessible(true);
        var data=new org.json.JSONObject("{\"id\":\"round\",\"game\":\"trivia\",\"mode\":\"final\",\"status\":\"active\",\"score\":0,\"correct\":0,\"nextIndex\":0,\"total\":10,\"serverNow\":1000,\"question\":{\"id\":\"q1\",\"kind\":\"choice\",\"index\":0,\"deadline\":11000,\"durationMs\":10000,\"prompt\":\"Bir ışık yılı neyin ölçüsüdür?\",\"options\":[\"Zaman\",\"Uzaklık\",\"Hız\",\"Sıcaklık\"]}}");
        accept.invoke(activity,data);data.put("question",org.json.JSONObject.NULL).put("locked",true).put("revealAt",11000);accept.invoke(activity,data);
        View root=activity.getWindow().getDecorView();assertNotNull(findText(root,"10 sn"));assertNotNull(findText(root,"Seçimin kilitlendi. Ortak sürenin bitmesini bekle."));
        assertFalse(findText(root,"A   Zaman").isEnabled());
        controller.pause().stop().destroy();
    }
    @Test public void ownerPanelShortcutUsesServerHintAndOpensTheFixedManagementUrl() throws Exception {
        var controller=Robolectric.buildActivity(MainActivity.class).setup();var activity=controller.get();
        var field=MainActivity.class.getDeclaredField("dashboard");field.setAccessible(true);
        var go=MainActivity.class.getDeclaredMethod("go",String.class);go.setAccessible(true);
        var data=new org.json.JSONObject().put("player",new org.json.JSONObject().put("name","Salih")).put("canManage",false);
        field.set(activity,data);go.invoke(activity,"profile");assertNull(findText(activity.getWindow().getDecorView(),"Yönetim paneli"));
        data.put("canManage",true);go.invoke(activity,"profile");View shortcut=findDescription(activity.getWindow().getDecorView(),"Yönetim paneli");assertNotNull(shortcut);shortcut.performClick();
        android.content.Intent intent=Shadows.shadowOf(activity).getNextStartedActivity();assertNotNull(intent);assertEquals(android.content.Intent.ACTION_VIEW,intent.getAction());assertEquals(BuildConfig.ARENA_ORIGIN+"/admin",intent.getData().toString());
        controller.pause().stop().destroy();
    }
    private static boolean hasTimer(View view){if(view instanceof TextView&&((TextView)view).getText().toString().matches("(10|15) sn"))return true;if(view instanceof ViewGroup){var group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)if(hasTimer(group.getChildAt(i)))return true;}return false;}
    private static View findText(View v,String text){if(v instanceof TextView&&((TextView)v).getText().toString().equals(text))return v;if(v instanceof ViewGroup){var group=(ViewGroup)v;for(int i=0;i<group.getChildCount();i++){View found=findText(group.getChildAt(i),text);if(found!=null)return found;}}return null;}
    private static View findDescription(View v,String label){if(label.contentEquals(v.getContentDescription()==null?"":v.getContentDescription()))return v;if(v instanceof ViewGroup){var group=(ViewGroup)v;for(int i=0;i<group.getChildCount();i++){View found=findDescription(group.getChildAt(i),label);if(found!=null)return found;}}return null;}
    private static void snapshot(View v,String name)throws Exception{v.measure(View.MeasureSpec.makeMeasureSpec(320,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(900,View.MeasureSpec.EXACTLY));v.layout(0,0,320,900);Bitmap bitmap=Bitmap.createBitmap(320,900,Bitmap.Config.ARGB_8888);v.draw(new Canvas(bitmap));File folder=new File("build/outputs/native-qa");folder.mkdirs();try(var out=new FileOutputStream(new File(folder,name+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}bitmap.recycle();}
}

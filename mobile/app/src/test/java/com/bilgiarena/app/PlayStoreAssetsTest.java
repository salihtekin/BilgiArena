package com.bilgiarena.app;
import android.graphics.*;
import android.view.*;
import android.widget.TextView;
import java.io.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import static org.junit.Assert.*;
/** Actual native view renders; not physical-device screenshots. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w360dp-h640dp-xxhdpi") @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PlayStoreAssetsTest {
 @Before public void setup(){Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions("android.permission.HIDE_OVERLAY_WINDOWS");RuntimeEnvironment.getApplication().getSharedPreferences("arena",0).edit().clear().putBoolean("onboarded",true).apply();}
 @Test public void exportActualNativeScreensForStoreListing()throws Exception{for(String game:new String[]{"trivia","word","reverse","math","memory","colors"})RuntimeEnvironment.getApplication().getSharedPreferences("arena",0).edit().putBoolean("tutorial-"+game,true).apply();
  var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();snapshot(a,"01-home");find(a.getWindow().getDecorView(),"Oyunlar",true).performClick();snapshot(a,"02-games");c.pause().stop().destroy();
  for(String[] game:new String[][]{{"Ters Köşe","03-reverse"},{"Harf Harmanı","04-anagram"},{"Hafıza İzi","05-memory"},{"Bilgi Arenası","06-trivia"},{"Eksik Sayı","07-math"}}){c=Robolectric.buildActivity(MainActivity.class).setup();a=c.get();find(a.getWindow().getDecorView(),"Oyunlar",true).performClick();find(a.getWindow().getDecorView(),game[0],true).performClick();find(a.getWindow().getDecorView(),"Antrenman yap  →",false).performClick();snapshot(a,game[1]);c.pause().stop().destroy();}
 }
 private View find(View v,String s,boolean description){if(description&&s.contentEquals(v.getContentDescription()==null?"":v.getContentDescription()))return v;if(!description&&v instanceof TextView&&((TextView)v).getText().toString().equals(s))return v;if(v instanceof ViewGroup){for(int i=0;i<((ViewGroup)v).getChildCount();i++){View f=find(((ViewGroup)v).getChildAt(i),s,description);if(f!=null)return f;}}return null;}
 private View findPrefix(View v,String prefix){if(v instanceof TextView&&((TextView)v).getText().toString().startsWith(prefix))return v;if(v instanceof ViewGroup){for(int i=0;i<((ViewGroup)v).getChildCount();i++){View f=findPrefix(((ViewGroup)v).getChildAt(i),prefix);if(f!=null)return f;}}return null;}
 private void assertFullyVisible(View control,String name){assertNotNull(name,control);Rect visible=new Rect();assertTrue(name,control.getGlobalVisibleRect(visible));assertEquals(name+" must fit without scrolling",control.getHeight(),visible.height());}
 private void snapshot(MainActivity a,String name)throws Exception{View v=a.getWindow().getDecorView();v.measure(View.MeasureSpec.makeMeasureSpec(1080,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(1920,View.MeasureSpec.EXACTLY));v.layout(0,0,1080,1920);Bitmap b=Bitmap.createBitmap(1080,1920,Bitmap.Config.ARGB_8888);v.draw(new Canvas(b));File dir=new File("build/outputs/play-store");assertTrue(dir.isDirectory()||dir.mkdirs());try(var out=new FileOutputStream(new File(dir,name+".png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}b.recycle();if(name.equals("06-trivia"))for(String prefix:new String[]{"A   ","B   ","C   ","D   "})assertFullyVisible(findPrefix(v,prefix),prefix);if(name.equals("07-math"))assertFullyVisible(find(v,"Kontrol et  →",false),"Math submit");}
}

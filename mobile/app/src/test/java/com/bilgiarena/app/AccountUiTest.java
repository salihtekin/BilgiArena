package com.bilgiarena.app;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import android.widget.CheckBox;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class AccountUiTest {
 @Before public void prepare(){Shadows.shadowOf(RuntimeEnvironment.getApplication()).grantPermissions("android.permission.HIDE_OVERLAY_WINDOWS");RuntimeEnvironment.getApplication().getSharedPreferences("arena",0).edit().clear().putBoolean("onboarded",true).apply();}
 @Test public void acknowledgementsStartUncheckedAndLegalTextIsAvailableOffline()throws Exception{
  var controller=Robolectric.buildActivity(MainActivity.class).setup();var a=controller.get();go(a,"account-setup");View root=a.getWindow().getDecorView();var terms=(CheckBox)find(root,"18 yaşını doldurdum ve kullanım koşullarını kabul ediyorum.");var privacy=(CheckBox)find(root,"Gizlilik metnini okudum.");assertFalse(terms.isChecked());assertFalse(privacy.isChecked());assertFalse(find(root,"Oyuncu kartını kaydet").isEnabled());terms.performClick();assertFalse(find(root,"Oyuncu kartını kaydet").isEnabled());privacy.performClick();assertTrue(find(root,"Oyuncu kartını kaydet").isEnabled());find(root,"Gizlilik metnini oku").performClick();assertNotNull(find(a.getWindow().getDecorView(),"Gizlilik ve kişisel veriler"));assertNotNull(find(a.getWindow().getDecorView(),"Saklama ve hesap silme"));a.onBackPressed();assertTrue(((CheckBox)find(a.getWindow().getDecorView(),"Gizlilik metnini okudum.")).isChecked());controller.pause().stop().destroy();
 }
 @Test public void cancellingDeletionKeepsLocalHistoryAndRequiresExplicitConfirmation()throws Exception{
  var prefs=RuntimeEnvironment.getApplication().getSharedPreferences("arena",0);prefs.edit().putString("practiceHistory","[{\"score\":10}]").apply();var controller=Robolectric.buildActivity(MainActivity.class).setup();var a=controller.get();go(a,"delete-account");find(a.getWindow().getDecorView(),"Hesabımı kalıcı sil").performClick();var dialog=ShadowAlertDialog.getLatestAlertDialog();assertNotNull(dialog);assertTrue(prefs.contains("practiceHistory"));dialog.getButton(android.app.AlertDialog.BUTTON_NEGATIVE).performClick();assertTrue(prefs.contains("practiceHistory"));controller.pause().stop().destroy();
 }
 private void go(MainActivity a,String section)throws Exception{var m=MainActivity.class.getDeclaredMethod("go",String.class);m.setAccessible(true);m.invoke(a,section);}
 private View find(View v,String s){if(v instanceof TextView&&((TextView)v).getText().toString().equals(s))return v;if(v instanceof ViewGroup){for(int i=0;i<((ViewGroup)v).getChildCount();i++){View found=find(((ViewGroup)v).getChildAt(i),s);if(found!=null)return found;}}return null;}
}

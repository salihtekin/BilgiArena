package com.bilgiarena.app;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CommerceUiTest {
 @Before public void setup(){var app=RuntimeEnvironment.getApplication();app.getSharedPreferences("arena",0).edit().clear().putBoolean("onboarded",true).apply();Shadows.shadowOf(app).grantPermissions("android.permission.HIDE_OVERLAY_WINDOWS");}
 @Test public void walletShowsOnlyActualServerBalancesAndMaskedBankMethod()throws Exception{
  var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"section","wallet");set(a,"walletData",new JSONObject("{\"availableKurus\":12345,\"heldKurus\":5000,\"earnedKurus\":20000,\"paidKurus\":2655,\"method\":{\"masked_iban\":\"TR33 •••• 1326\",\"revision\":1},\"awards\":[],\"payouts\":[],\"readiness\":{\"enabled\":false}}"));invoke(a,"render");View root=a.getWindow().getDecorView();assertNotNull(find(root,"Ödüllerim."));assertNotNull(find(root,"TR33 •••• 1326"));assertNull(find(root,"TR330006100519786457841326"));assertNull(find(root,"Para çekme isteği"));c.pause().stop().destroy();
 }
 @Test public void livePollingDoesNotClearDraftOrRestartMemoryForSameQuestion()throws Exception{
  var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"nextLivePoll",Long.MAX_VALUE);JSONObject r=new JSONObject("{\"liveCompetition\":true,\"id\":\"live1\",\"game\":\"math\",\"mode\":\"final\",\"status\":\"active\",\"phase\":\"question\",\"score\":0,\"correct\":0,\"nextIndex\":0,\"serverNow\":1000,\"locked\":false,\"question\":{\"id\":\"q1\",\"kind\":\"number\",\"prompt\":\"3 + ? = 7\",\"index\":0,\"deadline\":11000,\"durationMs\":10000}}" );accept(a,r);set(a,"draft","4");Object oldRoot=a.getWindow().getDecorView();r.put("serverNow",2000);accept(a,r);assertEquals("4",get(a,"draft"));assertSame(oldRoot,a.getWindow().getDecorView());assertEquals(2000,((JSONObject)get(a,"round")).optLong("serverNow"));c.pause().stop().destroy();
 }
 @Test public void liveLobbyUsesRealCheckinCountAndHasNoSimulatedOpponentClaim()throws Exception{
  var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"nextLivePoll",Long.MAX_VALUE);accept(a,new JSONObject("{\"liveCompetition\":true,\"id\":\"live2\",\"game\":\"math\",\"mode\":\"final\",\"status\":\"active\",\"phase\":\"lobby\",\"competition\":{\"id\":\"live2\",\"title\":\"Canlı final\",\"qualified\":200,\"checkedIn\":37,\"minimumCheckins\":2,\"startsAt\":1800000000000,\"checkinAt\":1799999400000,\"myStatus\":\"checked-in\",\"winnerCount\":1,\"canJoin\":false}}"));View root=a.getWindow().getDecorView();assertNotNull(find(root,"Canlı final"));assertNotNull(find(root,"Finalist: 200 · Katılan: 37 · Asgari katılım: 2"));assertNull(find(root,"Bilgisayar rakipleriyle antrenman"));c.pause().stop().destroy();
 }
 private void accept(MainActivity a,JSONObject value)throws Exception{var m=MainActivity.class.getDeclaredMethod("accept",JSONObject.class);m.setAccessible(true);m.invoke(a,value);}
 private void invoke(MainActivity a,String method)throws Exception{var m=MainActivity.class.getDeclaredMethod(method);m.setAccessible(true);m.invoke(a);}
 private void set(MainActivity a,String key,Object value)throws Exception{var f=MainActivity.class.getDeclaredField(key);f.setAccessible(true);f.set(a,value);}
 private Object get(MainActivity a,String key)throws Exception{var f=MainActivity.class.getDeclaredField(key);f.setAccessible(true);return f.get(a);}
 private View find(View v,String text){if(v instanceof TextView&&((TextView)v).getText().toString().equals(text))return v;if(v instanceof ViewGroup){for(int i=0;i<((ViewGroup)v).getChildCount();i++){View f=find(((ViewGroup)v).getChildAt(i),text);if(f!=null)return f;}}return null;}
}

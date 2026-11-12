package com.bilgiarena.app;
import android.view.*;
import android.widget.*;
import android.net.Uri;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlertDialog;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35,qualifiers="w320dp-h800dp-mdpi")
public class ImprovementsUiTest {
 @Before public void setup(){var app=RuntimeEnvironment.getApplication();app.getSharedPreferences("arena",0).edit().clear().putBoolean("onboarded",true).apply();Shadows.shadowOf(app).grantPermissions("android.permission.HIDE_OVERLAY_WINDOWS");}
 @Test public void firstExerciseTeachesBeforeStartingATimer()throws Exception{var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();invoke(a,"startPractice",new Class[]{String.class},"math");assertNull(get(a,"practice"));var d=ShadowAlertDialog.getLatestAlertDialog();assertNotNull(d);assertNotNull(find(d.getWindow().getDecorView(),"Bu örnekte süre ve puan yok."));find(d.getWindow().getDecorView(),"4").performClick();assertNotNull(get(a,"practice"));assertNotNull(find(a.getWindow().getDecorView(),"1 / 10"));assertEquals(0,((PracticeRound)get(a,"practice")).score);c.pause().stop().destroy();}
 @Test public void failedBankSaveKeepsOnlyTheInMemoryDraft()throws Exception{var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"section","bank-method");set(a,"walletData",new JSONObject("{\"method\":null}"));set(a,"bankName","Test Oyuncusu");set(a,"bankIban","TR330006100519786457841326");set(a,"bankOwn",true);invoke(a,"handleError",new Class[]{Exception.class},new ArenaApi.ApiException(503,"Bağlantı kurulamadı."));assertNotNull(find(a.getWindow().getDecorView(),"Test Oyuncusu"));assertNotNull(find(a.getWindow().getDecorView(),"TR330006100519786457841326"));assertFalse(RuntimeEnvironment.getApplication().getSharedPreferences("arena",0).getAll().toString().contains("TR330006100519786457841326"));c.pause().stop().destroy();}
 @Test public void rehearsalAwardDoesNotRequestBankDetails()throws Exception{var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"section","wallet");set(a,"walletData",new JSONObject("{\"awards\":[{\"amount_kurus\":0,\"status\":\"rehearsal\"}],\"payouts\":[],\"readiness\":{\"enabled\":false}}"));invoke(a,"render",new Class[]{});assertNull(find(a.getWindow().getDecorView(),"Kendi banka hesabını ekle"));c.pause().stop().destroy();}
 @Test public void noRankedQuotaShowsTrainingInsteadOfAnEnabledRankedButton()throws Exception{var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"section","detail");set(a,"dashboard",new JSONObject("{\"rankedRemaining\":0}"));invoke(a,"render",new Class[]{});assertNotNull(find(a.getWindow().getDecorView(),"Bugünkü 3 puanlı turun tamamlandı. Antrenmanlar açık."));assertNotNull(find(a.getWindow().getDecorView(),"Antrenman yap  →"));c.pause().stop().destroy();}
 @Test public void actualEarlyWinnerIsRecognizedWithOneCorrectAnswer()throws Exception{var c=Robolectric.buildActivity(MainActivity.class).setup();var a=c.get();set(a,"round",new JSONObject("{\"liveCompetition\":true,\"id\":\"final\",\"game\":\"memory\",\"mode\":\"final\",\"status\":\"completed\",\"score\":10,\"correct\":1,\"competition\":{\"myStatus\":\"winner\"},\"award\":{\"amount_kurus\":100000,\"status\":\"pending\"}}"));set(a,"showingResult",true);invoke(a,"render",new Class[]{});assertNotNull(find(a.getWindow().getDecorView(),"Finali kazandın!"));assertNotNull(find(a.getWindow().getDecorView(),"Sonuç kartımı paylaş"));c.pause().stop().destroy();}
 @Test public void sharingProviderRejectsOtherFilesAndAllWrites()throws Exception{var provider=new ResultShareProvider();assertThrows(java.io.FileNotFoundException.class,()->provider.openFile(Uri.parse("content://com.bilgiarena.app.results/private"),"r"));assertThrows(java.io.FileNotFoundException.class,()->provider.openFile(Uri.parse("content://com.bilgiarena.app.results/result.png"),"w"));}
 @Test public void accessibleMemoryPracticeHasMoreTimeWithoutChangingStandardRounds(){var a=new PracticeRound("memory",42,0);long normal=a.duration();a.accessible(true);assertEquals(30000,a.duration());assertTrue(normal<=15000);assertEquals(0,a.score);}
 private void invoke(MainActivity a,String name,Class[] types,Object... args)throws Exception{var m=MainActivity.class.getDeclaredMethod(name,types);m.setAccessible(true);m.invoke(a,args);}
 private void set(MainActivity a,String key,Object value)throws Exception{var f=MainActivity.class.getDeclaredField(key);f.setAccessible(true);f.set(a,value);}
 private Object get(MainActivity a,String key)throws Exception{var f=MainActivity.class.getDeclaredField(key);f.setAccessible(true);return f.get(a);}
 private View find(View v,String text){if(v instanceof TextView&&((TextView)v).getText().toString().equals(text))return v;if(v instanceof ViewGroup){for(int i=0;i<((ViewGroup)v).getChildCount();i++){var found=find(((ViewGroup)v).getChildAt(i),text);if(found!=null)return found;}}return null;}
}

package com.bilgiarena.app;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.util.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class RecoveryAndRecencyTest {
 @Test public void disabledDiagnosticsStoreNothingAndDelegate(){var p=RuntimeEnvironment.getApplication().getSharedPreferences("disabled",0);p.edit().clear().apply();boolean[] delegated={false};new CrashDiagnostics(p,(t,e)->delegated[0]=true).uncaughtException(Thread.currentThread(),new RuntimeException("PRIVATE DETAIL"));assertTrue(delegated[0]);assertEquals(0,CrashDiagnostics.pending(p));assertTrue(p.getAll().isEmpty());}
 @Test public void enabledDiagnosticsStoreOnlyBoundedCount(){var p=RuntimeEnvironment.getApplication().getSharedPreferences("enabled",0);p.edit().clear().putBoolean("analyticsConsent",true).putBoolean("connected",true).putInt("pendingCrashCount",99).apply();var failure=new RuntimeException("PRIVATE TOKEN AND NAME");Throwable[] delegated={null};new CrashDiagnostics(p,(t,e)->delegated[0]=e).uncaughtException(Thread.currentThread(),failure);assertSame(failure,delegated[0]);assertEquals(99,CrashDiagnostics.pending(p));assertFalse(p.getAll().toString().contains("PRIVATE"));CrashDiagnostics.acknowledged(p,98);assertEquals(1,CrashDiagnostics.pending(p));CrashDiagnostics.consent(p,false);assertFalse(p.contains("pendingCrashCount"));}
 @Test public void disconnectedDiagnosticsStoreNothing(){var p=RuntimeEnvironment.getApplication().getSharedPreferences("disconnected",0);p.edit().clear().putBoolean("analyticsConsent",true).apply();new CrashDiagnostics(p,(t,e)->{}).uncaughtException(Thread.currentThread(),new RuntimeException());assertEquals(0,CrashDiagnostics.pending(p));}
 @Test public void triviaPrefersQuestionsOutsidePreviousRound(){var first=new PracticeRound("trivia",4,0);var second=new PracticeRound("trivia",5,0,new HashSet<>(first.fingerprints()));assertTrue(Collections.disjoint(first.fingerprints(),second.fingerprints()));assertEquals(10,second.fingerprints().size());}
 @Test public void wordAndReverseShareRecency(){var first=new PracticeRound("word",4,0);var second=new PracticeRound("reverse",5,0,new HashSet<>(first.fingerprints()));assertTrue(Collections.disjoint(first.fingerprints(),second.fingerprints()));}
 @Test public void exhaustedPoolStillReturnsPlayableTenQuestions(){var first=new PracticeRound("trivia",4,0);var recent=new HashSet<String>();for(int i=0;i<200;i++)recent.addAll(new PracticeRound("trivia",i,0).fingerprints());var next=new PracticeRound("trivia",5,0,recent);assertEquals(10,next.fingerprints().size());assertNotNull(first.question().answer());}
}

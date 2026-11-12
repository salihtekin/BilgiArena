package com.bilgiarena.app;
import android.app.Activity;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;
/** No reward callbacks. Ad completion, failure and dismissal never grant points. */
final class AdsController {
 interface Telemetry{void record(String event,long micros,String currency,int precision);}
 private Telemetry telemetry=(e,m,c,p)->{};void telemetry(Telemetry value){telemetry=value;}
 private final Activity activity;private ConsentInformation consent;private InterstitialAd loaded;private boolean initialized,loading,closed,showing,consentRequested;
 AdsController(Activity a){activity=a;}
 void requestConsent(){if(!BuildConfig.ADS_ENABLED||closed||consentRequested)return;consentRequested=true;consent=UserMessagingPlatform.getConsentInformation(activity);consent.requestConsentInfoUpdate(activity,new ConsentRequestParameters.Builder().build(),()->UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity,error->initialize()),error->initialize());}
 private void initialize(){if(closed||consent==null||!consent.canRequestAds()||initialized)return;initialized=true;MobileAds.initialize(activity,status->load());}
 private void load(){if(closed||loading||!initialized||consent==null||!consent.canRequestAds())return;loading=true;InterstitialAd.load(activity,BuildConfig.ADMOB_INTERSTITIAL_ID,new AdRequest.Builder().build(),new InterstitialAdLoadCallback(){@Override public void onAdLoaded(InterstitialAd ad){loading=false;if(!closed){loaded=ad;ad.setOnPaidEventListener(value->telemetry.record("paid-estimate",value.getValueMicros(),value.getCurrencyCode(),value.getPrecisionType()));}}@Override public void onAdFailedToLoad(LoadAdError error){loading=false;loaded=null;}});}
 void showAtBreak(Runnable next){if(closed||!BuildConfig.ADS_ENABLED||activity.isFinishing()||loaded==null||showing||consent==null||!consent.canRequestAds()){next.run();load();return;}InterstitialAd ad=loaded;loaded=null;showing=true;ad.setFullScreenContentCallback(new FullScreenContentCallback(){@Override public void onAdImpression(){telemetry.record("impression",0,"TRY",0);}
 private boolean done;private void finish(){if(done)return;done=true;showing=false;next.run();load();}@Override public void onAdDismissedFullScreenContent(){finish();}@Override public void onAdFailedToShowFullScreenContent(AdError e){finish();}});ad.show(activity);}
 void privacyOptions(){if(!BuildConfig.ADS_ENABLED)return;if(consent!=null&&consent.getPrivacyOptionsRequirementStatus()==ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED)UserMessagingPlatform.showPrivacyOptionsForm(activity,error->{loaded=null;if(consent.canRequestAds()){initialize();load();}});else android.widget.Toast.makeText(activity,"Bu oturumda değiştirilecek reklam tercihi yok.",android.widget.Toast.LENGTH_SHORT).show();}
 void close(){closed=true;loaded=null;}
}

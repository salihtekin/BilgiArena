"""Record reproducible signature, package and completed local test evidence."""
from pathlib import Path
import argparse,subprocess,os,re,json,hashlib,ssl,xml.etree.ElementTree as ET
from datetime import datetime,timezone
p=argparse.ArgumentParser();p.add_argument('--sdk-root',required=True);p.add_argument('--java-home',required=True);p.add_argument('--logs',required=True);p.add_argument('--bundletool',required=True);args=p.parse_args()
root=Path(__file__).resolve().parents[1];gradle_text=(root/'mobile/app/build.gradle').read_text();version=re.search(r"versionName '([^']+)'",gradle_text).group(1);version_code=int(re.search(r'versionCode (\d+)',gradle_text).group(1));logs=Path(args.logs);jdk=Path(args.java_home);sdk=Path(args.sdk_root);env=dict(os.environ);env['JAVA_HOME']=str(jdk)
def run(name,command):
 r=subprocess.run([str(x) for x in command],cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);(logs/(name+'.log')).write_text(r.stdout);assert r.returncode==0,(name,r.returncode);return r.stdout
apk=root/'mobile/app/build/outputs/apk/release/app-release.apk';aab=root/'mobile/app/build/outputs/bundle/release/app-release.aab'
cert=hashlib.sha256((root/'release/upload-certificate.der').read_bytes()).hexdigest()
signature=run('apk-signature',[sdk/'build-tools/35.0.0/apksigner','verify','--verbose','--print-certs',apk]);assert 'Verifies' in signature and 'certificate SHA-256 digest: '+cert in signature
jar=run('aab-signature',[jdk/'bin/jarsigner','-verify','-verbose',aab]);assert 'jar verified.' in jar and 'jar is unsigned' not in jar
pem=run('aab-certificate',[jdk/'bin/keytool','-printcert','-jarfile',aab,'-rfc']);match=re.search(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',pem,re.S);assert match;assert hashlib.sha256(ssl.PEM_cert_to_DER_cert(match.group())).hexdigest()==cert
badging=run('apk-badging',[sdk/'build-tools/35.0.0/aapt','dump','badging',apk]);assert f"name='com.bilgiarena.app' versionCode='{version_code}' versionName='{version}'" in badging;assert "sdkVersion:'26'" in badging and "targetSdkVersion:'36'" in badging;assert 'application-debuggable' not in badging
permissions=re.findall(r"uses-permission: name='([^']+)'",badging);assert set(permissions)=={'android.permission.POST_NOTIFICATIONS','android.permission.RECEIVE_BOOT_COMPLETED','android.permission.INTERNET','android.permission.HIDE_OVERLAY_WINDOWS','android.permission.ACCESS_NETWORK_STATE','android.permission.ACCESS_ADSERVICES_AD_ID','android.permission.ACCESS_ADSERVICES_ATTRIBUTION','android.permission.ACCESS_ADSERVICES_TOPICS','android.permission.WAKE_LOCK','android.permission.FOREGROUND_SERVICE','com.bilgiarena.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}
assert 'com.google.android.gms.permission.AD_ID' not in permissions
run('bundletool-validation',[jdk/'bin/java','-jar',args.bundletool,'validate','--bundle='+str(aab)])
node=(logs/'tests-final.log').read_text();number=lambda k:sum(map(int,re.findall(r'(?m)^(?:#|ℹ) '+k+r' (\d+)$',node)));assert number('tests')>=106 and number('pass')==number('tests') and number('fail')==0
unit={'total':0,'failed':0,'skipped':0};suites=[]
for path in (root/'mobile/app/build/test-results/testDebugUnitTest').glob('TEST-*.xml'):
 r=ET.parse(path).getroot();n=int(r.attrib['tests']);f=int(r.attrib.get('failures',0))+int(r.attrib.get('errors',0));unit['total']+=n;unit['failed']+=f;unit['skipped']+=int(r.attrib.get('skipped',0));suites.append({'name':r.attrib['name'],'tests':n,'failed':f})
assert unit['total']>=24 and unit['failed']==0 and unit['skipped']==0,unit
assert (logs/'typescript-final.log').read_text()==''
assert 'CSS parse: passed' in (logs/'ui-smoke-final.log').read_text()
audit=json.loads((logs/'audit-production.json').read_text())['metadata']['vulnerabilities'];assert not any(audit.values())
all_audit=json.loads((logs/'audit-all.json').read_text())['metadata']['vulnerabilities']
source_hash=hashlib.sha256()
for path in sorted((root/'mobile/app/src/main').rglob('*')):
 if path.is_file():source_hash.update(str(path.relative_to(root)).encode());source_hash.update(path.read_bytes())
source_hash.update((root/'mobile/app/build.gradle').read_bytes())
record={'version':version,'versionCode':version_code,'packageName':'com.bilgiarena.app','targetSdk':36,'minSdk':26,'checkedAt':datetime.now(timezone.utc).isoformat(),'apkSignatureVerified':True,'aabSignatureVerified':True,'sameUploadCertificate':True,'certificateSha256':cert,'bundletoolValidation':True,'debuggable':False,'permissions':permissions,'apkSha256':hashlib.sha256(apk.read_bytes()).hexdigest(),'aabSha256':hashlib.sha256(aab.read_bytes()).hexdigest(),'androidSourceSha256':source_hash.hexdigest(),'serverTests':{'total':number('tests'),'passed':number('pass'),'failed':0},'androidTests':unit,'androidTestSuites':suites,'typescript':True,'serverRenderAndCss':True,'productionNpmAudit':audit,'allNpmAudit':all_audit,'physicalAndroidTested':False,'interactiveBrowserTested':False,'playIntegrityConfigured':False,'googlePlayUploaded':False,'googlePlayApproved':False,'cashEnabled':False,'liveAdsEnabled':False,'manualBankTransferVerified':False,'paymentMode':'manual_operator_confirmation','googleAdsSdk':'25.5.0','umpSdk':'4.0.0'}
dependency=json.loads((root/'release/dependency-audit.json').read_text());assert dependency['complete'] and not dependency['findings'],dependency
record['androidDependencyAudit']={k:dependency[k] for k in ['complete','packages','findings']}
lint=ET.parse(root/'mobile/app/build/reports/lint-results-release.xml').getroot();assert not [i for i in lint.findall('issue') if i.attrib.get('severity') in ['Error','Fatal']];record['androidLintErrors']=0
record['testAdsDebugBuildCompiled']='BUILD SUCCESSFUL' in (logs/'android-test-ads-build.log').read_text()
(root/'release/verification.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print('Release verified:',record['serverTests'],record['androidTests'],'API 36 / signed APK + AAB')

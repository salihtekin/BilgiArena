"""Package signed, already verified native outputs; never distribute signing secrets."""
from pathlib import Path
import argparse,hashlib,re,shutil,subprocess,zipfile,json
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reuse-verified-binaries',action='store_true',help='Recover unchanged signed APK/AAB files using their recorded hashes; do not imply a new Android build.')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
version=re.search(r"versionName '([^']+)'",(root/'mobile/app/build.gradle').read_text()).group(1)
downloads,releases=root/'public/downloads',root/'releases'
downloads.mkdir(exist_ok=True,parents=True);releases.mkdir(exist_ok=True,parents=True)
apk=downloads/f'BilgiArena-{version}.apk';aab=releases/f'BilgiArena-{version}.aab'
source=releases/f'BilgiArena-{version}-source.zip';play=releases/f'BilgiArena-{version}-Play-Upload.zip'
assert (root/'release/verification.json').is_file(),'Run and record release verification first'
verification=json.loads((root/'release/verification.json').read_text())
assert verification['version']==version,'Verification belongs to a different version'
assert verification['apkSignatureVerified'] and verification['aabSignatureVerified'] and verification['debuggable'] is False
assert verification['serverTests']['failed']==0 and verification['androidTests']['failed']==0
assert verification['androidTests']['total']>=14
# A version label alone cannot establish that these are the verified binaries.
source_hash=hashlib.sha256()
for path in sorted((root/'mobile/app/src/main').rglob('*')):
 if path.is_file():source_hash.update(str(path.relative_to(root)).encode());source_hash.update(path.read_bytes())
source_hash.update((root/'mobile/app/build.gradle').read_bytes())
if source_hash.hexdigest()!=verification.get('androidSourceSha256'):
 raise SystemExit('Android source changed after verification; rebuild and verify before packaging.')
binary_sources=[apk,aab] if args.reuse_verified_binaries else [root/'mobile/app/build/outputs/apk/release/app-release.apk',root/'mobile/app/build/outputs/bundle/release/app-release.aab']
for path,key in zip(binary_sources,['apkSha256','aabSha256']):
 if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=verification.get(key):
  raise SystemExit(f'Unverified or changed {key}: refusing to package.')
for original,destination in zip(binary_sources,[apk,aab]):
 if original.resolve()!=destination.resolve():shutil.copy2(original,destination)
# Obsolete debug/test builds stay recoverable in Git history, not on the live download path.
for old in downloads.glob('*.apk'):
 if old!=apk:old.unlink()
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
forbidden={'.jks','.keystore','.p12','.pfx','.pem','.pyc'}
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as package:
 for name in sorted(set(files)):
  if not name or name.startswith(('releases/','public/downloads/')) or name=='tsconfig.tsbuildinfo' or Path(name).suffix in forbidden or 'signing-secret' in name or 'PRIVATE' in Path(name).name or 'Signing-Backup' in Path(name).name:continue
  path=root/name
  if path.is_file():package.write(path,f'BilgiArena-{version}/{name}')
screens=list((root/'release/play-store/graphics').glob('0*.png'));assert len(screens)>=3,'Native store screens missing'
with zipfile.ZipFile(play,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as package:
 package.write(aab,aab.name)
 for p in sorted((root/'release').rglob('*')):
  if p.is_file():
   assert p.suffix not in forbidden and 'PRIVATE' not in p.name and 'signing-secret' not in p.name
   package.write(p,'release/'+str(p.relative_to(root/'release')))
entries=[]
for p in sorted([apk,aab,source,play]):entries.append(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root)}')
(releases/f'SHA256SUMS-{version}.txt').write_text('\n'.join(entries)+'\n')
for p in [apk,aab,source,play]:print(f'{p.name}: {p.stat().st_size} bytes')

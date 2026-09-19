"""Download the exact Android build dependencies used for this prototype."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlopen
from zipfile import ZipFile
root=Path(__file__).resolve().parents[2]/'toolchain';root.mkdir(exist_ok=True)
items=[('build.zip','https://dl.google.com/android/repository/build-tools_r35_linux.zip'),('platform.zip','https://dl.google.com/android/repository/platform-35_r02.zip'),('ecj.jar','https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.38.0/ecj-3.38.0.jar')]
def fetch(item):
 name,url=item;path=root/name
 if not path.exists():
  temp=path.with_suffix(path.suffix+'.part')
  with urlopen(url,timeout=120) as r,open(temp,'wb') as out:
   while True:
    data=r.read(1024*1024)
    if not data:break
    out.write(data)
  temp.replace(path)
 if name.endswith('.zip'):
  with ZipFile(path) as z:
   z.extractall(root)
   for entry in z.infolist():
    perms=entry.external_attr>>16
    if perms and not entry.is_dir():(root/entry.filename).chmod(perms & 0o777)
 print('Ready:',name)
with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(fetch,items))

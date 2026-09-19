"""Original squishy sound design. Offline PCM generation; no network/runtime dependency."""
from pathlib import Path
import numpy as np
from scipy.signal import butter,sosfilt
from scipy.io.wavfile import write
import subprocess
root=Path(__file__).resolve().parents[1];rate=44100;rng=np.random.default_rng(187)
def bubble(dur,f0,f1,decay=13):
 t=np.arange(int(rate*dur))/rate
 freq=f1+(f0-f1)*np.exp(-t*17)
 phase=2*np.pi*np.cumsum(freq)/rate
 return (np.sin(phase)+.16*np.sin(phase*2))*np.exp(-t*decay)*(1-np.exp(-t*160))
def save(name,data):
 data=np.tanh(data*1.5);data=data/(max(.01,np.max(np.abs(data))))*.75
 data[-min(900,len(data)):]*=np.linspace(1,0,min(900,len(data)))
 path=root/'assets/audio'/f'{name}.wav';write(path,rate,(data*32767).astype('int16'))
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-c:a','libvorbis','-q:a','5',str(path.with_suffix('.ogg'))],check=True);path.unlink()
# Warm, wet drop, with a bright suction lip.
p=bubble(.23,750,145,19)+.16*bubble(.23,1400,520,40);save('plop',p)
# A sequence of rising gulp bubbles and softly filtered liquid noise.
t=np.arange(int(rate*.72))/rate;s=np.zeros_like(t)
for i in range(11):
 b=bubble(.14,330+i*48,160+i*43,22)*(.40+i*.035);off=int((.024+i*.049)*rate);end=min(len(s),off+len(b));s[off:end]+=b[:end-off]
noise=sosfilt(butter(2,[480,2600],btype='bandpass',fs=rate,output='sos'),rng.normal(0,1,len(t)))
s+=noise*.10*np.sin(np.pi*t/.72)**2;save('slurp',s)
# Rubber spring, descending then settling, with an unobtrusive soft impact.
t=np.arange(int(.43*rate))/rate;f=160+500*np.exp(-t*9)*(1+.4*np.cos(t*38));phase=2*np.pi*np.cumsum(f)/rate
s=np.sin(phase)*np.exp(-t*9)*(1-np.exp(-t*200));s+=.15*bubble(.43,110,65,20);save('bounce',s)
# Sleepy bubbling sigh at the end of a round, a small pop for buttons.
s=np.zeros(int(.65*rate))
for i in range(3):
 b=bubble(.28,440-i*110,180-i*45,11);off=int(i*.16*rate);s[off:off+len(b)]+=b*.7
save('finish',s);save('tap',bubble(.10,700,380,35))
print('Five original sounds created.')

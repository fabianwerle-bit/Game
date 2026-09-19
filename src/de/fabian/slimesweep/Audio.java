package de.fabian.slimesweep;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.content.res.AssetFileDescriptor;
import java.util.HashSet;

final class Audio {
 private SoundPool pool;private final HashSet<Integer> ready=new HashSet<Integer>();private int[] ids=new int[5];private long last;
 Audio(Context context){
  pool=new SoundPool.Builder().setMaxStreams(7).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()).build();
  pool.setOnLoadCompleteListener(new SoundPool.OnLoadCompleteListener(){public void onLoadComplete(SoundPool p,int id,int status){if(status==0)synchronized(ready){ready.add(id);}}});
  String[] names={"plop.ogg","slurp.ogg","bounce.ogg","finish.ogg","tap.ogg"};
  for(int i=0;i<names.length;i++)try{AssetFileDescriptor f=context.getAssets().openFd("audio/"+names[i]);ids[i]=pool.load(f,1);f.close();}catch(Exception e){android.util.Log.w("SlimeSweep","Sound unavailable: "+names[i],e);}
 }
 void play(int event,boolean muted){
  if(muted||pool==null)return;int idx=event==1?0:event==2?1:event==3?2:event==4?3:4;
  long now=android.os.SystemClock.uptimeMillis();if(event==1&&now-last<65)return;if(event==1)last=now;
  synchronized(ready){if(!ready.contains(ids[idx]))return;}
  float pitch=event==1?.92f+(float)Math.random()*.22f:1;
  pool.play(ids[idx],event==1?.65f:.85f,event==1?.65f:.85f,1,0,pitch);
 }
 void release(){if(pool!=null){pool.release();pool=null;}}
}

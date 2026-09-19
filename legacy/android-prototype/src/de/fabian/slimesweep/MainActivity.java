package de.fabian.slimesweep;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.opengl.GLSurfaceView;

public final class MainActivity extends Activity {
 private GLSurfaceView surface; private GameUI ui; private World world; private Audio audio;
 @Override public void onCreate(Bundle b){
  super.onCreate(b);
  getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,WindowManager.LayoutParams.FLAG_FULLSCREEN);
  getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
  immersive();world=new World();world.best=getPreferences(0).getInt("best",0);world.muted=getPreferences(0).getBoolean("muted",false);
  audio=new Audio(this);FrameLayout root=new FrameLayout(this);
  surface=new GLSurfaceView(this);surface.setEGLContextClientVersion(2);surface.setEGLConfigChooser(8,8,8,0,16,0);surface.setPreserveEGLContextOnPause(true);
  surface.setRenderer(new Scene(this,world));root.addView(surface);
  ui=new GameUI(this,world,audio);root.addView(ui);setContentView(root);
 }
 private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE);}
 void persist(){getPreferences(0).edit().putInt("best",world.best).putBoolean("muted",world.muted).apply();}
 @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)immersive();else if(world!=null)synchronized(world){if(world.mode==World.PLAY)world.mode=World.PAUSE;world.inputX=world.inputY=0;}}
 @Override protected void onPause(){super.onPause();if(world!=null)synchronized(world){if(world.mode==World.PLAY)world.mode=World.PAUSE;world.inputX=world.inputY=0;persist();}if(ui!=null)ui.stop();if(surface!=null)surface.onPause();}
 @Override protected void onResume(){super.onResume();if(surface!=null)surface.onResume();if(ui!=null)ui.resume();}
 @Override protected void onDestroy(){if(ui!=null)ui.stop();if(audio!=null)audio.release();super.onDestroy();}
 @Override public void onBackPressed(){synchronized(world){if(world.mode==World.PLAY){world.mode=World.PAUSE;world.inputX=world.inputY=0;}else if(world.mode==World.MAP)world.mode=World.HOME;else if(world.mode==World.PAUSE)world.mode=World.PLAY;else super.onBackPressed();}}
}

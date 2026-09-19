package de.fabian.slimesweep;

import android.graphics.*;
import android.view.*;

final class GameUI extends View implements Choreographer.FrameCallback {
 private final MainActivity activity;private final World w;private final Audio audio;
 private final Paint p=new Paint(3);private final RectF r=new RectF();private final Path path=new Path();
 private float scale=1,H=800,joyX=195,joyY=675,knobX,knobY,anim=0;private int pointer=-1;
 private long lastFrame=0;private boolean running=false;private int lastSaved=-1;
 private static final int INK=0xff153940,CREAM=0xfff6f8e9,LIME=0xffc8f879,MUTED=0xffaac5bc,CORAL=0xffffaa8c;
 GameUI(MainActivity a,World world,Audio sound){super(a);activity=a;w=world;audio=sound;setLayerType(View.LAYER_TYPE_SOFTWARE,null);setFocusable(true);}
 void resume(){if(!running){running=true;lastFrame=0;Choreographer.getInstance().postFrameCallback(this);}}
 void stop(){running=false;Choreographer.getInstance().removeFrameCallback(this);pointer=-1;w.inputX=w.inputY=0;}
 public void doFrame(long ns){if(!running)return;float dt=lastFrame==0?0:(ns-lastFrame)/1e9f;lastFrame=ns;
  synchronized(w){w.step(dt);anim+=Math.min(dt,.05f);if(w.event>0){audio.play(w.event,w.muted);if(w.event==2||w.event==3)performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);w.event=0;}
   if(w.mode==World.OVER&&lastSaved!=w.score){activity.persist();lastSaved=w.score;}}
  invalidate();Choreographer.getInstance().postFrameCallback(this);
 }
 private void fill(int color){p.setColor(color);p.setStyle(Paint.Style.FILL);p.setShader(null);p.setStrokeWidth(1);}
 private void box(Canvas c,float x,float y,float width,float h,float radius,int color){fill(color);r.set(x,y,x+width,y+h);c.drawRoundRect(r,radius,radius,p);}
 private void text(Canvas c,String s,float x,float y,float size,int color,boolean bold){fill(color);p.setTypeface(Typeface.create("sans-serif"+(bold?"-medium":""),bold?Typeface.BOLD:Typeface.NORMAL));p.setTextSize(size);p.setTextAlign(Paint.Align.LEFT);c.drawText(s,x,y,p);}
 private void center(Canvas c,String s,float y,float size,int color,boolean bold){fill(color);p.setTypeface(Typeface.create("sans-serif",bold?Typeface.BOLD:Typeface.NORMAL));p.setTextSize(size);p.setTextAlign(Paint.Align.CENTER);c.drawText(s,195,y,p);p.setTextAlign(Paint.Align.LEFT);}
 private void circle(Canvas c,float x,float y,float radius,int color){fill(color);c.drawCircle(x,y,radius,p);}
 private void button(Canvas c,String label,float y,boolean primary){box(c,26,y,338,57,22,primary?LIME:0xee264b4d);center(c,label,y+36,18,primary?INK:CREAM,true);}
 @Override public void onDraw(Canvas c){super.onDraw(c);scale=getWidth()/390f;H=getHeight()/scale;joyY=H-106;joyX=195;c.save();c.scale(scale,scale);
  synchronized(w){
   if(w.mode==World.HOME)home(c);
   else if(w.mode==World.MAP)mapScreen(c);
   else {hud(c);if(w.mode==World.PAUSE)pause(c);if(w.mode==World.OVER)over(c);}
  }c.restore();
 }
 private void gradient(Canvas c,float y,float h,int top,int bottom){fill(top);p.setShader(new LinearGradient(0,y,0,y+h,top,bottom,Shader.TileMode.CLAMP));c.drawRect(0,y,390,y+h,p);p.setShader(null);}
 private void home(Canvas c){
  gradient(c,0,H*.5f,0xd918343b,0x0018343b);gradient(c,H*.48f,H*.52f,0x0018343b,0xf918343b);
  box(c,26,30,168,28,14,0xd9224547);text(c,"KLEINE INSEL. GROSSES CHAOS.",37,49,8.4f,LIME,true);
  box(c,316,27,48,42,16,0xd9224547);soundIcon(c,340,48);
  text(c,"SLIME",25,125,62,CREAM,true);text(c,"SWEEP",23,183,64,LIME,true);
  text(c,"Schlürf dich zum Highscore.",28,214,16,CREAM,false);
  float yy=H-245;
  box(c,26,yy,338,52,18,0xd91c3c40);text(c,"DEIN REKORD",44,yy+21,10,MUTED,true);text(c,""+w.best,44,yy+42,20,CREAM,true);
  text(c,"100 % Schleim. 0 % Langeweile.",140,yy+32,11,LIME,false);
  button(c,"LOS SCHLÜRFEN!   ›",H-174,true);button(c,"INSEL ANSEHEN",H-105,false);
  center(c,"OFFLINE  ·  KEINE WERBUNG  ·  PROTOTYP 0.2",H-24,9,MUTED,false);
 }
 private void hud(Canvas c){
  gradient(c,0,160,0xa018343b,0x0018343b);
  box(c,16,22,126,65,20,w.time<12?0xf05b3034:0xec163b41);
  text(c,"ZEIT",30,42,10,w.time<12?CORAL:MUTED,true);
  text(c,""+(int)Math.ceil(w.time),30,73,31,CREAM,true);text(c,"SEK",83,71,10,MUTED,true);
  box(c,151,22,163,65,20,0xec163b41);text(c,"PUNKTE",167,42,10,MUTED,true);text(c,""+w.score,167,74,30,LIME,true);
  box(c,324,22,50,65,18,0xec163b41);box(c,340,44,5,21,2,CREAM);box(c,352,44,5,21,2,CREAM);
  box(c,16,98,196,48,17,0xe6163b41);text(c,w.bag>=10?"VOLLER BAUCH!":"MÜLL IM BAUCH",29,117,9,w.bag>=10?CORAL:MUTED,true);
  text(c,w.bag+" / 10",143,119,13,CREAM,true);box(c,29,128,170,5,3,0xff365c59);if(w.bag>0)box(c,29,128,17*w.bag,5,3,LIME);
  minimap(c,288,100,85);
  text(c,"CHAOS "+w.stage()+"  ·  ZEIT ×"+String.format(java.util.Locale.US,"%.1f",w.drain()),19,164,9,CREAM,true);
  float toastY=H*.30f;
  if(w.toastTime>0){box(c,18,toastY,354,39,15,0xec163b41);center(c,w.toast,toastY+25,w.toast.length()>39?11:12,CREAM,true);}
  if(w.bag>0){
   float dx=World.DEPOT_X-w.x,dz=World.DEPOT_Z-w.z,dist=World.distance(w.x,w.z,0,-1);
   if(dist>3){
    float yaw=(float)Math.toRadians(w.camera.yaw);float sn=(float)Math.sin(yaw),cs=(float)Math.cos(yaw);
    float sx=-dx*cs+dz*sn,sy=-(dx*sn+dz*cs);
    float n=Math.max(.01f,(float)Math.sqrt(sx*sx+sy*sy));float ax=195+sx/n*88,ay=H*.52f+sy/n*68;
    c.save();c.translate(ax,ay);c.rotate((float)Math.toDegrees(Math.atan2(sy,sx))+90);
    path.reset();path.moveTo(0,-12);path.lineTo(10,9);path.lineTo(0,5);path.lineTo(-10,9);path.close();fill(INK);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(5);c.drawPath(path,p);fill(LIME);c.drawPath(path,p);c.restore();
   }
  }
  gradient(c,H-224,224,0x0018343b,0xb318343b);
  text(c,w.bag==10?"ZUR STATION!":"ROLLEN & SAMMELN",20,H-182,10,CREAM,true);
  text(c,w.bag==10?"Der Pfeil zeigt dir den Weg.":"Alles andere passiert automatisch.",20,H-165,11,CREAM,false);
  circle(c,joyX,joyY,67,0x55204447);fill(0x77ecffe4);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(1.5f);c.drawCircle(joyX,joyY,66,p);
  circle(c,joyX,joyY,44,0x302a554d);
  float kx=pointer>=0?knobX:0,ky=pointer>=0?knobY:0;
  circle(c,joyX+kx,joyY+ky+3,28,0x660a202c);circle(c,joyX+kx,joyY+ky,28,LIME);
  circle(c,joyX+kx-7,joyY+ky-5,3,INK);circle(c,joyX+kx+7,joyY+ky-5,3,INK);
  fill(INK);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);r.set(joyX+kx-5,joyY+ky-1,joyX+kx+5,joyY+ky+8);c.drawArc(r,15,150,false,p);
  center(c,"ZIEHEN ZUM ROLLEN",H-22,9,CREAM,false);
  if(w.invulnerable>1.5f){fill(0x22ff795c);c.drawRect(0,0,390,H,p);}
 }
 private void minimap(Canvas c,float left,float top,float size){
  box(c,left-3,top-3,size+6,size+6,16,0xe61c4447);c.save();r.set(left,top,left+size,top+size);path.reset();path.addRoundRect(r,13,13,Path.Direction.CW);c.clipPath(path);
  fill(0xff80cda0);c.drawRect(left,top,left+size,top+size,p);
  float unit=size/36;
  for(int k=-1;k<=1;k+=2){box(c,left+(18+k*6-1.5f)*unit,top,3*unit,size,0,0xff537e81);box(c,left,top+(18+k*6-1.5f)*unit,size,3*unit,0,0xff537e81);}
  for(World.Building b:w.buildings)box(c,left+(b.x+18-b.w/2)*unit,top+(b.z+18-b.d/2)*unit,b.w*unit,b.d*unit,2,0xfff3d9b2);
  for(World.Item t:w.trash)circle(c,left+(t.x+18)*unit,top+(t.z+18)*unit,size<100?1:2,0xfff6eeaa);
  circle(c,left+18*unit,top+17*unit,size<100?4:8,0xffecffc5);
  circle(c,left+(w.x+18)*unit,top+(w.z+18)*unit,size<100?3.5f:7,INK);circle(c,left+(w.x+18)*unit,top+(w.z+18)*unit,size<100?2:4,LIME);c.restore();
 }
 private void mapScreen(Canvas c){
  fill(0xee14353c);c.drawRect(0,0,390,H,p);text(c,"DEINE KLEINE",26,63,12,LIME,true);text(c,"CHAOS-INSEL",24,102,32,CREAM,true);
  center(c,"Ein Rundkurs. Unendlich viel Quatsch.",135,13,MUTED,false);
  float mapTop=Math.max(166,(H-338)*.42f);minimap(c,29,mapTop,332);
  center(c,"● Du     ◉ Recycling     · Müll",mapTop+362,13,LIME,false);
  button(c,"ZURÜCK",H-94,false);
 }
 private void dim(Canvas c){fill(0xde102d35);c.drawRect(0,0,390,H,p);}
 private void pause(Canvas c){dim(c);float y=H*.31f;center(c,"KURZE SCHLEIMPAUSE",y,24,CREAM,true);center(c,"Deine Insel wartet auf dich.",y+31,14,MUTED,false);
  button(c,"WEITERROLLEN",y+67,true);button(c,w.muted?"TON EINSCHALTEN":"TON AUSSCHALTEN",y+137,false);button(c,"ZUM STARTMENÜ",y+207,false);
 }
 private void over(Canvas c){dim(c);float y=H*.20f;center(c,"FEIERABEND!",y,35,LIME,true);center(c,"Dein Schleim braucht ein Nickerchen.",y+31,13,CREAM,false);
  box(c,26,y+60,338,157,26,0xff24494b);center(c,"DEIN SCORE",y+91,11,MUTED,true);center(c,""+w.score,y+151,58,CREAM,true);
  center(c,w.score>0&&w.score>=w.best?"NEUER REKORD!":"REKORD  "+w.best,y+192,13,LIME,true);
  center(c,w.delivered+" Müllteile gerettet  ·  "+(int)w.elapsed+" Sekunden",y+247,13,CREAM,false);
  button(c,"NOCH EINE RUNDE!",y+280,true);button(c,"ZUM STARTMENÜ",y+350,false);
 }
 private void soundIcon(Canvas c,float x,float y){fill(w.muted?MUTED:LIME);path.reset();path.moveTo(x-11,y-5);path.lineTo(x-5,y-5);path.lineTo(x+1,y-11);path.lineTo(x+1,y+11);path.lineTo(x-5,y+5);path.lineTo(x-11,y+5);path.close();c.drawPath(path,p);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(2);
  if(w.muted){c.drawLine(x+6,y-5,x+13,y+5,p);c.drawLine(x+6,y+5,x+13,y-5,p);}else{r.set(x-5,y-11,x+14,y+11);c.drawArc(r,-65,130,false,p);}p.setStyle(Paint.Style.FILL);
 }
 private boolean at(float y,float start){return y>=start&&y<=start+57;}
 @Override public boolean onTouchEvent(android.view.MotionEvent e){
  float x=e.getX()/scale,y=e.getY()/scale;int action=e.getActionMasked();
  synchronized(w){
   if(action==MotionEvent.ACTION_DOWN){
    if(w.mode==World.HOME){if(x>310&&y<80){w.muted=!w.muted;activity.persist();}else if(at(y,H-174)){w.start();lastSaved=-1;}else if(at(y,H-105))w.mode=World.MAP;audio.play(0,w.muted);}
    else if(w.mode==World.MAP){if(at(y,H-94))w.mode=World.HOME;}
    else if(w.mode==World.PAUSE){float a=H*.31f;if(at(y,a+67))w.mode=World.PLAY;else if(at(y,a+137)){w.muted=!w.muted;activity.persist();}else if(at(y,a+207))w.mode=World.HOME;audio.play(0,w.muted);}
    else if(w.mode==World.OVER){float a=H*.20f;if(at(y,a+280)){w.start();lastSaved=-1;}else if(at(y,a+350))w.mode=World.HOME;audio.play(0,w.muted);}
    else if(w.mode==World.PLAY){if(x>320&&y<95){w.mode=World.PAUSE;w.inputX=w.inputY=0;pointer=-1;}else if(y>H-240){pointer=e.getPointerId(0);w.controlYaw=w.camera.yaw;moveJoy(x,y);}}
   }else if(action==MotionEvent.ACTION_MOVE&&pointer>=0&&w.mode==World.PLAY){int index=e.findPointerIndex(pointer);if(index>=0)moveJoy(e.getX(index)/scale,e.getY(index)/scale);}
   else if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL||(action==MotionEvent.ACTION_POINTER_UP&&e.getPointerId(e.getActionIndex())==pointer)){pointer=-1;knobX=knobY=0;w.inputX=w.inputY=0;}
  }invalidate();return true;
 }
 private void moveJoy(float x,float y){float dx=x-joyX,dy=y-joyY,n=(float)Math.sqrt(dx*dx+dy*dy);if(n>48){dx*=48/n;dy*=48/n;}knobX=dx;knobY=dy;w.inputX=dx/48;w.inputY=dy/48;}
}

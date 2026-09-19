package de.fabian.slimesweep;

import android.content.Context;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import java.nio.*;
import java.io.*;
import java.util.*;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

final class Scene implements GLSurfaceView.Renderer {
 private final World w;private final Context context;
 private final HashMap<String,Mesh> meshes=new HashMap<String,Mesh>();
 private float[] projection=new float[16],view=new float[16],model=new float[16],vp=new float[16],mvp=new float[16];
 private int program,aPos,aNorm,aCol,uMvp,uModel,uTint,uAlpha,uGloss,uEye;private float ratio=.5f;
 private Mesh cube,sphere,disc;
 private static class Mesh {int buffer,count;Mesh(float[] data){count=data.length/9;FloatBuffer fb=ByteBuffer.allocateDirect(data.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();fb.put(data).position(0);int[] b=new int[1];GLES20.glGenBuffers(1,b,0);buffer=b[0];GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,buffer);GLES20.glBufferData(GLES20.GL_ARRAY_BUFFER,data.length*4,fb,GLES20.GL_STATIC_DRAW);}}
 Scene(Context c,World world){context=c;w=world;}
 public void onSurfaceCreated(GL10 gl,EGLConfig config){
  String vertex="uniform mat4 uMvp;uniform mat4 uModel;attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;varying vec3 col;varying vec3 normal;varying vec3 pos;void main(){gl_Position=uMvp*vec4(aPos,1.0);vec3 n=normalize(mat3(uModel)*aNorm);float l=0.78+0.22*max(dot(n,normalize(vec3(-0.5,1.0,0.7))),0.0);col=aCol*l;normal=n;pos=(uModel*vec4(aPos,1.0)).xyz;}";
  String fragment="precision mediump float;varying vec3 col;varying vec3 normal;varying vec3 pos;uniform vec3 uTint;uniform vec3 uEye;uniform float uAlpha;uniform float uGloss;void main(){vec3 n=normalize(normal);vec3 h=normalize(normalize(vec3(-0.5,1.0,0.7))+normalize(uEye-pos));float shine=pow(max(dot(n,h),0.0),38.0)*uGloss;gl_FragColor=vec4(col*uTint+vec3(shine),uAlpha);}";
  program=GLES20.glCreateProgram();GLES20.glAttachShader(program,shader(GLES20.GL_VERTEX_SHADER,vertex));GLES20.glAttachShader(program,shader(GLES20.GL_FRAGMENT_SHADER,fragment));GLES20.glLinkProgram(program);
  int[] ok=new int[1];GLES20.glGetProgramiv(program,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]==0)throw new RuntimeException(GLES20.glGetProgramInfoLog(program));
  aPos=GLES20.glGetAttribLocation(program,"aPos");aNorm=GLES20.glGetAttribLocation(program,"aNorm");aCol=GLES20.glGetAttribLocation(program,"aCol");uMvp=GLES20.glGetUniformLocation(program,"uMvp");uModel=GLES20.glGetUniformLocation(program,"uModel");uTint=GLES20.glGetUniformLocation(program,"uTint");uAlpha=GLES20.glGetUniformLocation(program,"uAlpha");uGloss=GLES20.glGetUniformLocation(program,"uGloss");uEye=GLES20.glGetUniformLocation(program,"uEye");
  GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA);GLES20.glDisable(GLES20.GL_CULL_FACE);GLES20.glClearColor(.52f,.79f,.96f,1);
  cube=makeCube();sphere=makeSphere();disc=makeDisc();meshes.clear();
  try{for(String file:context.getAssets().list("models")){if(!file.endsWith(".mesh"))continue;DataInputStream in=new DataInputStream(context.getAssets().open("models/"+file));int count=in.readInt();float[] data=new float[count*9];for(int i=0;i<data.length;i++)data[i]=in.readFloat();in.close();meshes.put(file.substring(0,file.length()-5),new Mesh(data));}}
  catch(IOException e){throw new RuntimeException("Asset loading failed",e);}
 }
 private int shader(int type,String code){int s=GLES20.glCreateShader(type);GLES20.glShaderSource(s,code);GLES20.glCompileShader(s);int[] ok=new int[1];GLES20.glGetShaderiv(s,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]==0)throw new RuntimeException(GLES20.glGetShaderInfoLog(s));return s;}
 public void onSurfaceChanged(GL10 gl,int width,int height){GLES20.glViewport(0,0,width,height);ratio=(float)width/height;}
 public void onDrawFrame(GL10 gl){
  GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);GLES20.glUseProgram(program);
  synchronized(w){
   boolean home=w.mode==World.HOME||w.mode==World.MAP;
   Matrix.perspectiveM(projection,0,64,ratio,.12f,135);
   if(home){
    Matrix.setLookAtM(view,0,2.5f,2.5f,8,0,1.0f,2.5f,0,1,0);
   }else{
    ChaseCamera rig=w.camera;
    Matrix.setLookAtM(view,0,rig.eyeX,rig.eyeY,rig.eyeZ,rig.targetX,rig.targetY,rig.targetZ,0,1,0);
   }
   Matrix.multiplyMM(vp,0,projection,0,view,0);
   GLES20.glUniform3f(uEye,home?2.5f:w.camera.eyeX,home?2.5f:w.camera.eyeY,home?8:w.camera.eyeZ);
   GLES20.glUniform1f(uAlpha,1);GLES20.glUniform1f(uGloss,0);
   draw(cube,0,-1.4f,0,150,.3f,150,0,0x76C8CF);
   for(int i=0;i<16;i++){float t=w.clock*.22f+i*2.5f;draw(cube,(float)Math.sin(i*2.4)*24,-1.20f,(float)Math.cos(i*2.4)*24+t%2,.9f,.02f,.08f,0,0x9CDADD);}
   draw(cube,0,-.65f,0,34,1.1f,34,0,0xEFD6A0);
   asset("grass",0,-.04f,0,33,1,33,0);
   // The actual Kenney road meshes include pavement, kerbs and lane markings.
   for(int row=-4;row<=4;row++)for(int col=-4;col<=4;col++){
    boolean v=Math.abs(col)==2,h=Math.abs(row)==2;if(!v&&!h)continue;
    asset(v&&h?"cross":"road",col*3,0,row*3,3,3,3,v?90:0);
   }
   asset("path",0,.015f,0,20,1,20,0);
   for(int i=0;i<w.buildings.size();i++){
    World.Building b=w.buildings.get(i);shadow(b.x,b.z,b.w*.7f,b.d*.65f);
    int idx=i%4;boolean shop=i<6||i>=8;
    float[] widths=shop?new float[]{.88359f,.88359f,.97f,1.64f}:new float[]{1.3f,1.28638f,1.45f,1.27f};
    float[] depths=shop?new float[]{.94f,1.09f,.922f,1.00789f}:new float[]{1.02814f,1.02814f,1.178f,1.028f};
    float facing=i<6?(b.x<0?90:-90):(i<8?(b.z<0?0:180):(b.x<0?-90:90));
    boolean sideways=Math.abs(facing)==90;
    float scaleX=(sideways?b.d:b.w)/widths[idx],scaleZ=(sideways?b.w:b.d)/depths[idx];
    float sy=Math.min(scaleX,scaleZ);
    asset((shop?"shop":"house")+idx,b.x,.035f,b.z,scaleX,sy,scaleZ,facing);
    if(shop){
     float a=(float)Math.toRadians(facing),frontX=(float)Math.sin(a),frontZ=(float)Math.cos(a);
     asset("awning",b.x+frontX*(b.w*.5f+.15f),.035f,b.z+frontZ*(b.d*.5f+.15f),3.7f,5,3.7f,facing);
    }
    asset("bush",b.x-b.w/2-.25f,.025f,b.z,2,2.5f,2,0);
    for(int f=0;f<5;f++)asset(f%2==0?"flower":"flowerYellow",b.x-1+f*.5f,.03f,b.z+b.d/2+.35f,1.8f,1.8f,1.8f,0);
   }
   for(float[] t:w.trees){shadow(t[0],t[1],.7f,.55f);asset("palm",t[0],0,t[1],2.8f*t[2],3.5f*t[2],2.8f*t[2],t[0]*8);}
   for(int i=0;i<6;i++){float xx=i%2==0?-3.5f:3.5f,zz=-12+(i/2)*12;asset("lamp",xx,.05f,zz,3.2f,3.2f,3.2f,i%2==0?0:180);}
   for(int i=0;i<12;i++){float angle=i*2.399f;asset("rock",(float)Math.cos(angle)*16.5f,-.3f,(float)Math.sin(angle)*16.5f,2,2,2,i*47);}
   for(int i=0;i<5;i++){
    float ox=-23+i*11,oz=-30-(i%2)*6;
    asset("rock",ox,-1.1f,oz,17,20+(i%3)*8,17,i*37);
    asset("tree",ox,1.7f,oz,13,9,13,i*30);
   }
   // Street cafe corners, planted verges and bright original prop meshes.
   for(int i=0;i<6;i++){
    float xx=i<3?-12.8f:12.8f,zz=-3+(i%3)*2.2f;
    asset("parasol",xx,.04f,zz,4.2f,4.2f,4.2f,i*45);
   }
   for(int i=0;i<28;i++){
    float a=i*.79f,xx=(float)Math.cos(a)*13.6f,zz=(float)Math.sin(a)*13.6f;
    asset(i%2==0?"flowerPurple":"flowerYellow",xx,0,zz,2.8f,2.8f,2.8f,i*31);
   }
   depot();
   for(World.Item t:w.trash){
    float bob=.12f+(float)Math.sin(w.clock*3+t.phase)*.055f;
    if(t.air>0)bob+=t.air*1.4f+(float)Math.sin(t.air/.8f*Math.PI)*.9f;
    shadow(t.x,t.z,.28f,.22f);
    if(meshes.containsKey("trash"+t.kind))asset("trash"+t.kind,t.x,bob,t.z,1.8f,1.8f,1.8f,t.phase*57+w.clock*18);
    else draw(cube,t.x,bob+.15f,t.z,.32f,.32f,.32f,t.phase*57,0xFFE6AF);
   }
   for(World.Car car:w.cars){shadow(car.x,car.z,.8f,.75f);asset("car"+car.color,car.x,.07f,car.z,.66f,.66f,.66f,car.alongX?(car.dir>0?90:-90):(car.dir>0?0:180));}
   for(World.Person person:w.people){float hop=(float)Math.abs(Math.sin(w.clock*6+person.phase))*.045f;shadow(person.x,person.z,.25f,.22f);asset("person"+person.color,person.x,.055f+hop,person.z,1.7f,1.7f,1.7f,person.alongX?90:180);}
   float bodyAlpha=home?1:Math.max(.12f,Math.min(1,(w.camera.distance-1.0f)/2.0f));
   GLES20.glUniform1f(uAlpha,bodyAlpha);GLES20.glDepthMask(true);
   slime(home?0:w.x,home?3:w.z,home?45:w.heading,home);
   GLES20.glDepthMask(true);GLES20.glUniform1f(uAlpha,1);
   for(World.Particle p:w.particles){float size=.12f*p.life/p.max;draw(sphere,p.x,Math.max(.1f,p.y),p.z,size,size,size,0,p.color);}
  }
 }
 private void depot(){
  float pulse=1+(float)Math.sin(w.clock*3)*.06f;
  draw(disc,0,.065f,-1,1.85f*pulse,1,1.85f*pulse,0,0xCFF593);draw(disc,0,.071f,-1,1.50f,1,1.50f,0,0x7FC991);
  // Gameplay station: rounded green bin with smiling eyes and a wide mouth.
  shadow(0,-1.65f,.95f,.55f);
  draw(cube,0,.53f,-1.65f,1.5f,1,1.05f,0,0x3D9E87);
  draw(cube,0,1.08f,-1.65f,1.65f,.17f,1.2f,0,0xC3F477);
  draw(cube,0,1.18f,-1.65f,.95f,.05f,.50f,0,0x1F4747);
  draw(sphere,-.34f,.78f,-1.10f,.14f,.17f,.05f,0,0xFFFFFF);draw(sphere,.34f,.78f,-1.10f,.14f,.17f,.05f,0,0xFFFFFF);
  draw(sphere,-.31f,.76f,-1.05f,.06f,.085f,.025f,0,0x183943);draw(sphere,.37f,.76f,-1.05f,.06f,.085f,.025f,0,0x183943);
  draw(cube,0,.46f,-1.105f,.40f,.12f,.025f,0,0x183943);
  float yy=2.3f+(float)Math.sin(w.clock*3)*.13f;
  draw(sphere,0,yy,-1.65f,.33f,.33f,.33f,0,0xD8FF93);
  draw(cube,0,yy,-1.30f,.33f,.075f,.02f,0,0x2A725F);draw(cube,0,yy,-1.30f,.075f,.33f,.02f,0,0x2A725F);
 }
 private void slime(float x,float z,float heading,boolean home){
  float roll=w.clock*(w.speed>.1f?11:2.8f);float bounce=(float)Math.abs(Math.sin(roll))*(w.speed>.1f?.12f:.025f);
  float swell=1+w.bag*.016f,squish=(float)Math.sin(roll)*.045f;float height=.58f+bounce;
  shadow(x,z,.83f*swell,.64f*swell);
  if(!home)GLES20.glUniform1f(uAlpha,Math.max(.12f,Math.min(1,(w.camera.distance-1.0f)/2.0f)));
  int body=w.invulnerable>0&&((int)(w.clock*10)%2)==0?0xFFD994:0xACEB68;
  GLES20.glUniform1f(uGloss,.85f);
  draw(sphere,x,height,z,(.79f+squish)*swell,(.61f-squish)*swell,(.72f+squish)*swell,heading,body);
  GLES20.glUniform1f(uGloss,.12f);
  // Soft feet, cheeks, big forward-facing eyes, highlights, and a tiny smile.
  float yaw=(home?45:heading)*(float)Math.PI/180;
  float sx=(float)Math.cos(yaw),sz=-(float)Math.sin(yaw),fx=(float)Math.sin(yaw),fz=(float)Math.cos(yaw);
  for(int side=-1;side<=1;side+=2){
   float ex=x+sx*.27f*side+fx*.54f,ez=z+sz*.27f*side+fz*.54f;
   draw(sphere,ex,height+.22f,ez,.235f,.285f,.20f,heading,0xFFFEF6);
   draw(sphere,ex+fx*.135f,height+.20f,ez+fz*.135f,.108f,.15f,.105f,heading,0x1A3742);
   draw(sphere,ex+fx*.194f-sx*.025f,height+.25f,ez+fz*.194f-sz*.025f,.038f,.045f,.038f,heading,0xFFFFFF);
   draw(sphere,x+sx*.43f*side+fx*.53f,height-.08f,z+sz*.43f*side+fz*.53f,.12f,.05f,.08f,heading,0xF8B0A0);
  }
  draw(sphere,x+fx*.69f,height-.12f,z+fz*.69f,.10f,.045f,.07f,heading,0x21433C);
  draw(sphere,x-.28f,height+.49f,z-.19f,.16f,.055f,.18f,-30,0xDCFFA8);
  GLES20.glUniform1f(uGloss,0);
  if(w.bag>0)for(int i=0;i<Math.min(5,w.bag);i++){
   float a=i*1.4f;asset("trash"+(i%3),x+(float)Math.cos(a)*.5f,height+.25f,z+(float)Math.sin(a)*.5f,.85f,.85f,.85f,heading+i*51);
  }
 }
 private void shadow(float x,float z,float sx,float sz){GLES20.glUniform1f(uAlpha,.18f);draw(disc,x,.083f,z,sx,1,sz,0,0x15383B);GLES20.glUniform1f(uAlpha,1);}
 private void asset(String name,float x,float y,float z,float sx,float sy,float sz,float ry){Mesh mesh=meshes.get(name);if(mesh!=null)draw(mesh,x,y,z,sx,sy,sz,ry,0xFFFFFF);}
 private void draw(Mesh mesh,float x,float y,float z,float sx,float sy,float sz,float ry,int color){
  Matrix.setIdentityM(model,0);Matrix.translateM(model,0,x,y,z);if(ry!=0)Matrix.rotateM(model,0,ry,0,1,0);Matrix.scaleM(model,0,sx,sy,sz);Matrix.multiplyMM(mvp,0,vp,0,model,0);
  GLES20.glUniformMatrix4fv(uMvp,1,false,mvp,0);GLES20.glUniformMatrix4fv(uModel,1,false,model,0);GLES20.glUniform3f(uTint,((color>>16)&255)/255f,((color>>8)&255)/255f,(color&255)/255f);
  GLES20.glBindBuffer(GLES20.GL_ARRAY_BUFFER,mesh.buffer);
  GLES20.glEnableVertexAttribArray(aPos);GLES20.glVertexAttribPointer(aPos,3,GLES20.GL_FLOAT,false,36,0);GLES20.glEnableVertexAttribArray(aNorm);GLES20.glVertexAttribPointer(aNorm,3,GLES20.GL_FLOAT,false,36,12);GLES20.glEnableVertexAttribArray(aCol);GLES20.glVertexAttribPointer(aCol,3,GLES20.GL_FLOAT,false,36,24);
  GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,mesh.count);
 }
 private void vertex(ArrayList<Float>d,float x,float y,float z,float nx,float ny,float nz){float[] a={x,y,z,nx,ny,nz,1,1,1};for(float f:a)d.add(f);}
 private Mesh mesh(ArrayList<Float>d){float[] a=new float[d.size()];for(int i=0;i<a.length;i++)a[i]=d.get(i);return new Mesh(a);}
 private Mesh makeCube(){ArrayList<Float>d=new ArrayList<Float>();float[][] n={{0,0,1},{0,0,-1},{1,0,0},{-1,0,0},{0,1,0},{0,-1,0}};float[][][] f={{{-.5f,-.5f,.5f},{.5f,-.5f,.5f},{.5f,.5f,.5f},{-.5f,.5f,.5f}},{{.5f,-.5f,-.5f},{-.5f,-.5f,-.5f},{-.5f,.5f,-.5f},{.5f,.5f,-.5f}},{{.5f,-.5f,.5f},{.5f,-.5f,-.5f},{.5f,.5f,-.5f},{.5f,.5f,.5f}},{{-.5f,-.5f,-.5f},{-.5f,-.5f,.5f},{-.5f,.5f,.5f},{-.5f,.5f,-.5f}},{{-.5f,.5f,.5f},{.5f,.5f,.5f},{.5f,.5f,-.5f},{-.5f,.5f,-.5f}},{{-.5f,-.5f,-.5f},{.5f,-.5f,-.5f},{.5f,-.5f,.5f},{-.5f,-.5f,.5f}}};for(int face=0;face<6;face++)for(int i:new int[]{0,1,2,0,2,3})vertex(d,f[face][i][0],f[face][i][1],f[face][i][2],n[face][0],n[face][1],n[face][2]);return mesh(d);}
 private Mesh makeSphere(){ArrayList<Float>d=new ArrayList<Float>();for(int j=0;j<12;j++)for(int i=0;i<20;i++){for(int[] offset:new int[][]{{0,0},{1,0},{1,1},{0,0},{1,1},{0,1}}){double a=(i+offset[0])*Math.PI*2/20,b=(j+offset[1])*Math.PI/12-Math.PI/2;float x=(float)(Math.cos(a)*Math.cos(b)),y=(float)Math.sin(b),z=(float)(Math.sin(a)*Math.cos(b));vertex(d,x,y,z,x,y,z);}}return mesh(d);}
 private Mesh makeDisc(){ArrayList<Float>d=new ArrayList<Float>();for(int i=0;i<32;i++){vertex(d,0,0,0,0,1,0);for(int k=0;k<2;k++){double a=(i+k)*Math.PI*2/32;vertex(d,(float)Math.cos(a),0,(float)Math.sin(a),0,1,0);}}return mesh(d);}
}

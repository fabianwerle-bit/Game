package de.fabian.slimesweep;

import java.util.ArrayList;
import java.util.Random;

/** Platform-independent rules; coordinates in metres, all times in seconds. */
public final class World {
 public static final int HOME=0, PLAY=1, PAUSE=2, OVER=3, MAP=4;
 public int mode=HOME, best=0, score=0, bag=0, delivered=0, event=0, combo=0;
 public float x=0,z=3,camX=0,camZ=1, heading=180,time=55,elapsed=0,clock=0;
 public float inputX=0,inputY=0,speed=0,invulnerable=0,bankFlash=0,toastTime=0;
 public final ChaseCamera camera=new ChaseCamera();
 public float controlYaw=180;
 public String toast="";
 public boolean muted=false;
 private float spawnClock=0,bankCooldown=0,comboClock=0;
 private final Random rng=new Random(76331);
 public final ArrayList<Building> buildings=new ArrayList<Building>();
 public final ArrayList<Item> trash=new ArrayList<Item>();
 public final ArrayList<Particle> particles=new ArrayList<Particle>();
 public final ArrayList<Car> cars=new ArrayList<Car>();
 public final ArrayList<Person> people=new ArrayList<Person>();
 public final ArrayList<float[]> trees=new ArrayList<float[]>();
 public static final float DEPOT_X=0,DEPOT_Z=-1;
 public static final class Building {
  public float x,z,w,d,h; public int color;
  Building(float a,float b,float c,float e,float f,int co){x=a;z=b;w=c;d=e;h=f;color=co;}
 }
 public static final class Item {public float x,z,phase,air=0;public int kind;Item(float a,float b,int k,float p){x=a;z=b;kind=k;phase=p;}}
 public static final class Particle {public float x,y,z,vx,vy,vz,life,max;public int color;}
 public static final class Car {public float x,z,t,dir;public boolean alongX;public int color;}
 public static final class Person {public float x,z,t,phase;public boolean alongX;public int color;}
 public World(){
  buildings.add(new Building(-10,-10,4.1f,4,3.5f,0));
  buildings.add(new Building(-10,-1.3f,4,3.5f,2.5f,1));
  buildings.add(new Building(-10,10,4.4f,3.8f,3.1f,2));
  buildings.add(new Building(10,-10,4,4.2f,4.0f,3));
  buildings.add(new Building(10,0,4,3.6f,2.8f,0));
  buildings.add(new Building(10,10,4.1f,4,3.6f,1));
  buildings.add(new Building(0,-10.4f,3.8f,3.3f,2.6f,2));
  buildings.add(new Building(0,10.5f,3.5f,3.4f,2.4f,3));
  buildings.add(new Building(-2.65f,3.15f,2.5f,2.5f,4,0));
  buildings.add(new Building(2.65f,3.15f,2.5f,2.5f,4,1));
  buildings.add(new Building(-2.65f,-3.6f,2.5f,2.5f,4,2));
  buildings.add(new Building(2.65f,-3.6f,2.5f,2.5f,4,3));
  for(int i=0;i<24;i++){
   float a=(float)(i*Math.PI*2/24),r=i%2==0?14.0f:14.8f;
   trees.add(new float[]{(float)Math.cos(a)*r,(float)Math.sin(a)*r,0.7f+rng.nextFloat()*.4f});
  }
  for(int i=0;i<6;i++){
   Car c=new Car();c.alongX=i<3;c.dir=i%2==0?1:-1;c.t=-14+i*5;c.color=i%4;cars.add(c);
  }
  for(int i=0;i<18;i++){
   Person p=new Person();p.alongX=i%2==0;p.t=-13+(i*3)%27;p.phase=i;p.color=i%4;people.add(p);
  }
  scatter(45);updateActors(0);camera.reset(this);
 }
 public void start(){
  mode=PLAY;x=-5.7f;z=9.4f;camX=x;camZ=z;heading=180;controlYaw=180;camera.reset(this);time=55;elapsed=0;score=0;bag=0;delivered=0;
  invulnerable=0;bankFlash=0;spawnClock=0;bankCooldown=0;combo=0;comboClock=0;event=0;
  inputX=inputY=0;trash.clear();particles.clear();scatter(45);say("Sammeln. Abliefern. Insel retten!",4);
 }
 public void say(String s,float duration){toast=s;toastTime=duration;}
 public boolean blocked(float a,float b){
  if(Math.abs(a)>15.8f||Math.abs(b)>15.8f)return true;
  for(Building h:buildings)if(Math.abs(a-h.x)<h.w/2+.43f&&Math.abs(b-h.z)<h.d/2+.43f)return true;
  return false;
 }
 private void scatter(int count){
  for(int j=0;j<count;j++){
   for(int tries=0;tries<60;tries++){
    float a=-14+rng.nextFloat()*28,b=-14+rng.nextFloat()*28;
    // Most litter lands on streets; some is around houses and the park.
    if(j%3!=0){if(j%2==0)a=(rng.nextBoolean()?6:-6)+(rng.nextFloat()-.5f)*2;else b=(rng.nextBoolean()?6:-6)+(rng.nextFloat()-.5f)*2;}
    if(!blocked(a,b)&&distance(a,b,0,-1)>2.3f){trash.add(new Item(a,b,rng.nextInt(3),rng.nextFloat()*6.28f));break;}
   }
  }
 }
 public static float distance(float a,float b,float c,float d){return (float)Math.sqrt((a-c)*(a-c)+(b-d)*(b-d));}
 public float drain(){return Math.min(2.9f,1+elapsed/85);}
 public int stage(){return 1+(int)(elapsed/35);}
 public void step(float dt){
  dt=Math.max(0,Math.min(dt,.05f));
  if(mode==PAUSE||mode==MAP||mode==OVER)return;
  clock+=dt;updateActors(dt);
  if(mode!=PLAY)return;
  elapsed+=dt;time-=dt*drain();invulnerable=Math.max(0,invulnerable-dt);bankFlash=Math.max(0,bankFlash-dt);
  toastTime=Math.max(0,toastTime-dt);bankCooldown-=dt;comboClock-=dt;if(comboClock<=0)combo=0;
  float norm=(float)Math.sqrt(inputX*inputX+inputY*inputY);
  float ix=inputX,iy=inputY;if(norm>1){ix/=norm;iy/=norm;norm=1;}
  speed=norm*(bag==10?4.25f:5.3f);
  // Capture the camera frame at the start of each joystick gesture. Holding a
  // direction stays straight while the camera catches up, even during a U-turn.
  float yaw=(float)Math.toRadians(controlYaw),sn=(float)Math.sin(yaw),cs=(float)Math.cos(yaw);
  float rate=bag==10?4.25f:5.3f;
  float vx=(-iy*sn-ix*cs)*rate,vz=(-iy*cs+ix*sn)*rate;
  if(!blocked(x+vx*dt,z))x+=vx*dt;
  if(!blocked(x,z+vz*dt))z+=vz*dt;
  if(norm>.1f){float wanted=(float)Math.toDegrees(Math.atan2(vx,vz));heading+=ChaseCamera.angleDelta(heading,wanted)*(1-(float)Math.exp(-12*dt));}
  camX+=(x-camX)*Math.min(1,dt*5);camZ+=(z-camZ)*Math.min(1,dt*5);
  for(Item item:trash)item.air=Math.max(0,item.air-dt);
  for(int i=trash.size()-1;i>=0&&bag<10;i--){Item item=trash.get(i);if(item.air<.2f&&distance(x,z,item.x,item.z)<1.1f){
   trash.remove(i);bag++;event=1;burst(item.x,item.z,0xC8F879,5);
   if(bag==10)say("Voll! Zur grünen Recyclingstation",3);
  }}
  if(bag>0&&distance(x,z,DEPOT_X,DEPOT_Z)<1.85f&&bankCooldown<=0){
   combo=Math.min(4,combo+1);comboClock=22;int gain=bag*10+Math.max(0,bag-5)*5;
   gain+=(combo-1)*bag*2;score+=gain;delivered+=bag;
   float bonus=bag*1.65f;time=Math.min(75,time+bonus);bag=0;bankCooldown=1;bankFlash=1;event=2;
   say("+"+gain+" Punkte  ·  +"+(int)bonus+" Sekunden",2.5f);burst(0,-1,0xC8F879,30);
  }
  for(Car c:cars)if(invulnerable<=0&&distance(x,z,c.x,c.z)<1.15f){
   time-=4;invulnerable=2;event=3;say("Hoppla! Auto erwischt: −4 Sekunden",2);
   float dx=x-c.x,dz=z-c.z,n=Math.max(.1f,distance(x,z,c.x,c.z));
   float nx=x+dx/n*1.2f,nz=z+dz/n*1.2f;if(!blocked(nx,nz)){x=nx;z=nz;}
   burst(x,z,0xFFAC88,12);
  }
  camera.update(this,dt);
  spawnClock+=dt;
  if(spawnClock>Math.max(.7f,2.7f-elapsed/100)){
   spawnClock=0;if(trash.size()<100){
    Person p=people.get(rng.nextInt(people.size()));float a=p.x+(rng.nextFloat()-.5f)*1.7f,b=p.z+(rng.nextFloat()-.5f)*1.7f;
    if(!blocked(a,b)){Item item=new Item(a,b,rng.nextInt(3),rng.nextFloat()*6);item.air=.8f;trash.add(item);}else scatter(1);
   }
  }
  for(int i=particles.size()-1;i>=0;i--){Particle p=particles.get(i);p.life-=dt;if(p.life<=0){particles.remove(i);continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=5*dt;}
  if(time<=0){time=0;mode=OVER;best=Math.max(best,score);inputX=inputY=0;event=4;}
 }
 private void updateActors(float dt){
  for(int i=0;i<cars.size();i++){Car c=cars.get(i);c.t+=dt*c.dir*(2.1f+i*.21f);if(c.t>16)c.t=-16;if(c.t< -16)c.t=16;float lane=i%2==0?-6.5f:6.5f;c.x=c.alongX?c.t:lane;c.z=c.alongX?lane:c.t;}
  for(int i=0;i<people.size();i++){Person p=people.get(i);p.t+=dt*(i%2==0?.65f:-.7f);if(p.t>15)p.t=-15;if(p.t< -15)p.t=15;float lane=i%3==0?-4.1f:4.1f;p.x=p.alongX?p.t:lane;p.z=p.alongX?lane:p.t;}
 }
 private void burst(float a,float b,int color,int count){
  for(int i=0;i<count;i++){Particle p=new Particle();p.x=a;p.z=b;p.y=.55f;p.vx=(rng.nextFloat()-.5f)*4;p.vz=(rng.nextFloat()-.5f)*4;p.vy=1+rng.nextFloat()*3;p.life=p.max=.5f+rng.nextFloat()*.6f;p.color=color;particles.add(p);}
 }
}

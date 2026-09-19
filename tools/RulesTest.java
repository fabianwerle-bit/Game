package de.fabian.slimesweep;
public class RulesTest {
 static void check(boolean b,String s){if(!b)throw new AssertionError(s);}
 public static void main(String[] args){
  World w=new World();w.start();check(w.mode==World.PLAY&&w.trash.size()==45,"start state");
  w.x=0;w.z=3;w.trash.clear();for(int i=0;i<15;i++)w.trash.add(new World.Item(0,3,i%3,0));w.step(.01f);
  check(w.bag==10&&w.trash.size()==5,"capacity and automatic pickup");
  w.x=0;w.z=-1;w.time=20;w.step(.01f);check(w.bag==0&&w.delivered==10&&w.score==125,"banking");check(w.time>36&&w.time<37,"time reward");
  w.mode=World.PAUSE;float time=w.time,x=w.x;w.inputX=1;w.step(.05f);check(w.time==time&&w.x==x,"pause freezes simulation");
  w.mode=World.PLAY;w.x=15.7f;w.z=0;w.inputX=w.inputY=1;for(int i=0;i<50;i++)w.step(.05f);check(w.x<=15.8f,"island boundary");
  check(w.blocked(-10,-10),"building collision");check(!w.blocked(0,3),"spawn clear");
  w.inputX=w.inputY=0;w.elapsed=200;check(w.drain()>2,"increasing difficulty");
  World.Car car=w.cars.get(0);w.x=car.x;w.z=car.z;w.invulnerable=0;w.time=20;w.step(.01f);check(w.time<16&&w.invulnerable>0,"car penalty");
  w.x=0;w.z=3;w.time=.001f;w.step(.05f);check(w.mode==World.OVER&&w.best==125,"game over saves best");
  w.start();check(w.score==0&&w.bag==0&&w.best==125,"restart resets round and retains best");
  System.out.println("PASS: 11 gameplay checks (pickup, capacity, banking, time, pause, bounds, collision, difficulty, traffic, game over, restart)");
 }
}

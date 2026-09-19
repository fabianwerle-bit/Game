package de.fabian.slimesweep;
public class CameraTest {
 static void check(boolean yes,String s){if(!yes)throw new AssertionError(s);}
 public static void main(String[] a){
  World w=new World();w.start();float z=w.z;w.controlYaw=w.camera.yaw;w.inputY=-1;
  for(int i=0;i<10;i++)w.step(.02f);
  check(w.z<z,"forward moves into view");check(w.camera.eyeZ>w.z,"camera stays behind");
  w.x=0;w.z=5;w.cars.clear();w.controlYaw=180;w.inputX=1;w.inputY=0;
  float yaw=w.camera.yaw;w.step(.02f);check(Math.abs(ChaseCamera.angleDelta(yaw,w.camera.yaw))<10,"smooth turn, no snap");
  float x=w.x;for(int i=0;i<20;i++)w.step(.02f);check(w.x>x,"screen right initially moves right");
  check(w.camera.yaw<170,"camera pans behind turn");
  check(Math.abs(ChaseCamera.angleDelta(179,-179)-2)<.001,"shortest arc at wrap");
  w.x=-10;w.z=-6.8f;w.heading=0;w.camera.reset(w);check(w.camera.distance<2,"house obstruction shortens camera");
  check(w.camera.eyeY<3,"street-level height");
  w.x=0;w.z=0;w.heading=180;w.camera.update(w,.05f);check(w.camera.distance<4.6f,"smooth distance recovery");
  for(int i=0;i<100;i++)w.camera.update(w,.05f);check(w.camera.distance>4.5,"distance recovers");
  System.out.println("PASS: third-person forward/right input, smooth yaw, behind-player position, angle wrap, low height and camera-wall recovery");
 }
}

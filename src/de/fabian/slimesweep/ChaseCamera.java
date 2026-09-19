package de.fabian.slimesweep;

/** A perspective chase rig: low behind the player, with a swept obstruction check. */
public final class ChaseCamera {
 public float yaw=180,distance=4.6f,eyeX,eyeY,eyeZ,targetX,targetY,targetZ;
 public static float angleDelta(float from,float to){float d=(to-from)%360;if(d>180)d-=360;if(d< -180)d+=360;return d;}
 public void reset(World w){yaw=w.heading;distance=4.6f;update(w,0);}
 public void update(World w,float dt){
  float alpha=1-(float)Math.exp(-5.2f*dt);
  yaw+=angleDelta(yaw,w.heading)*alpha;
  float rad=(float)Math.toRadians(yaw),fx=(float)Math.sin(rad),fz=(float)Math.cos(rad);
  float desired=4.6f;
  // Shorten immediately at obstacles; recover gently once the camera has room.
  for(float d=.35f;d<=4.8f;d+=.10f){
   float xx=w.x-fx*d,zz=w.z-fz*d;
   boolean collision=false;
   for(World.Building b:w.buildings){
    if(Math.abs(xx-b.x)<b.w*.5f+.35f&&Math.abs(zz-b.z)<b.d*.5f+.35f){collision=true;break;}
   }
   if(collision){desired=Math.max(.55f,d-.28f);break;}
  }
  if(desired<distance||dt==0)distance=desired;else distance+=(desired-distance)*(1-(float)Math.exp(-3*dt));
  eyeX=w.x-fx*distance;eyeZ=w.z-fz*distance;eyeY=1.25f+distance*.27f;
  targetX=w.x+fx*1.6f;targetZ=w.z+fz*1.6f;targetY=1.1f;
 }
}

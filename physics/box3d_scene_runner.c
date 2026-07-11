// SPDX-License-Identifier: MIT

#include "box3d/box3d.h"

#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct BodyInput {
  char name[64];
  int dynamic;
  int bodyType;
  float half[3];
  float position[3];
  float rotation[4];
  float linearVelocity[3];
  float angularVelocity[3];
  float density;
  float friction;
  float restitution;
  float linearDamping;
  float angularDamping;
  float gravityScale;
  float sleepThreshold;
  int enableSleep;
  int isAwake;
  int isBullet;
  int isEnabled;
  int allowFastRotation;
  int enableContactRecycling;
  int motionLocks[6];
  b3BodyId bodyId;
} BodyInput;

typedef struct JointInput {
  char name[64];
  char type[16];
  int bodyA;
  int bodyB;
  float localFrameA[3];
  float localFrameB[3];
  float localFrameAQuat[4];
  float localFrameBQuat[4];
  float hertz;
  float dampingRatio;
  float lowerAngle;
  float upperAngle;
  int enableSpring;
  int releaseStep;
  float releaseAngularVelocity[3];
  float releaseAngularImpulse[3];
  float targetAngle;
  int enableLimit;
  int collideConnected;
  b3JointId jointId;
} JointInput;

typedef struct EventStats {
  int contactBeginCount;
  int contactEndCount;
  int contactHitCount;
  int jointEventCount;
  int bodyMoveCount;
} EventStats;

static bool ReadScene(FILE *input, float gravity[3], float *timeStep,
                      int *substeps, int *totalSteps, int *sampleEvery,
                      float *groundHeight, float *groundHalfExtent,
                      float *groundFriction, float *groundRestitution,
                      float *restitutionThreshold, float *hitEventThreshold,
                      float *contactHertz, float *contactDampingRatio,
                      float *contactSpeed, float *maximumLinearSpeed,
                      int *enableSleep, int *enableContinuous,
                      BodyInput **bodiesOut, int *bodyCountOut,
                      JointInput **jointsOut, int *jointCountOut,
                      int *versionOut) {
  char keyword[32];
  int version = 0;
  if (fscanf(input, "%31s %d", keyword, &version) != 2 ||
      strcmp(keyword, "B3SCENE") != 0 ||
      (version != 1 && version != 2 && version != 3 && version != 4 &&
       version != 5)) {
    return false;
  }

  int bodyCount = 0;
  int jointCount = 0;
  int fields = version == 5
                   ? fscanf(input,
                            "%31s %f %f %f %f %d %d %d %f %f %f %f %d %d "
                            "%f %f %f %f %f %f %d %d",
                            keyword, &gravity[0], &gravity[1], &gravity[2],
                            timeStep, substeps, totalSteps, sampleEvery,
                            groundHeight, groundHalfExtent, groundFriction,
                            groundRestitution, &bodyCount, &jointCount,
                            restitutionThreshold, hitEventThreshold,
                            contactHertz, contactDampingRatio, contactSpeed,
                            maximumLinearSpeed, enableSleep, enableContinuous)
                   : version == 2 || version == 3 || version == 4
                   ? fscanf(input,
                            "%31s %f %f %f %f %d %d %d %f %f %f %f %d %d",
                            keyword, &gravity[0], &gravity[1], &gravity[2],
                            timeStep, substeps, totalSteps, sampleEvery,
                            groundHeight, groundHalfExtent, groundFriction,
                            groundRestitution, &bodyCount, &jointCount)
                   : fscanf(input,
                            "%31s %f %f %f %f %d %d %d %f %f %f %f %d",
                            keyword, &gravity[0], &gravity[1], &gravity[2],
                            timeStep, substeps, totalSteps, sampleEvery,
                            groundHeight, groundHalfExtent, groundFriction,
                            groundRestitution, &bodyCount);
  if ((version == 1 && fields != 13) ||
      ((version == 2 || version == 3 || version == 4) && fields != 14) ||
      (version == 5 && fields != 22) ||
      strcmp(keyword, "world") != 0 || bodyCount <= 0 || jointCount < 0) {
    return false;
  }

  BodyInput *bodies = calloc((size_t)bodyCount, sizeof(BodyInput));
  if (bodies == NULL) {
    return false;
  }
  for (int i = 0; i < bodyCount; ++i) {
    BodyInput *body = bodies + i;
    int fields;
    if (version == 4 || version == 5) {
      fields = fscanf(
          input,
          "%31s %63s %d "
          "%f %f %f "
          "%f %f %f "
          "%f %f %f %f "
          "%f %f %f "
          "%f %f %f "
          "%f %f %f "
          "%f %f %f %f "
          "%d %d %d %d %d %d "
          "%d %d %d %d %d %d",
          keyword, body->name, &body->bodyType, &body->half[0],
          &body->half[1], &body->half[2], &body->position[0],
          &body->position[1], &body->position[2], &body->rotation[0],
          &body->rotation[1], &body->rotation[2], &body->rotation[3],
          &body->linearVelocity[0], &body->linearVelocity[1],
          &body->linearVelocity[2], &body->angularVelocity[0],
          &body->angularVelocity[1], &body->angularVelocity[2],
          &body->density, &body->friction, &body->restitution,
          &body->linearDamping, &body->angularDamping, &body->gravityScale,
          &body->sleepThreshold, &body->enableSleep, &body->isAwake,
          &body->isBullet, &body->isEnabled, &body->allowFastRotation,
          &body->enableContactRecycling, &body->motionLocks[0],
          &body->motionLocks[1], &body->motionLocks[2], &body->motionLocks[3],
          &body->motionLocks[4], &body->motionLocks[5]);
      body->dynamic = body->bodyType == 2;
    } else {
      fields = fscanf(
          input,
          "%31s %63s %d "
          "%f %f %f "
          "%f %f %f "
          "%f %f %f %f "
          "%f %f %f "
          "%f %f %f "
          "%f %f %f",
          keyword, body->name, &body->dynamic, &body->half[0],
          &body->half[1], &body->half[2], &body->position[0],
          &body->position[1], &body->position[2], &body->rotation[0],
          &body->rotation[1], &body->rotation[2], &body->rotation[3],
          &body->linearVelocity[0], &body->linearVelocity[1],
          &body->linearVelocity[2], &body->angularVelocity[0],
          &body->angularVelocity[1], &body->angularVelocity[2],
          &body->density, &body->friction, &body->restitution);
      body->bodyType = body->dynamic ? 2 : 0;
    }
    if (((version == 4 || version == 5) && fields != 38) ||
        (version != 4 && version != 5 && fields != 22) ||
        strcmp(keyword, "body") != 0 || body->bodyType < 0 ||
        body->bodyType >= b3_bodyTypeCount) {
      free(bodies);
      return false;
    }
  }
  JointInput *joints = NULL;
  if (jointCount > 0) {
    joints = calloc((size_t)jointCount, sizeof(JointInput));
    if (joints == NULL) {
      free(bodies);
      return false;
    }
    for (int i = 0; i < jointCount; ++i) {
      JointInput *joint = joints + i;
      int jointFields;
      if (version == 3) {
        jointFields = fscanf(
            input,
            "%31s %63s %15s %d %d "
            "%f %f %f %f %f %f "
            "%f %f %f %f %f %f %f %f "
            "%f %f %f %f %d %d %f %f %f %f %d %d",
            keyword, joint->name, joint->type, &joint->bodyA, &joint->bodyB,
            &joint->localFrameA[0], &joint->localFrameA[1],
            &joint->localFrameA[2], &joint->localFrameB[0],
            &joint->localFrameB[1], &joint->localFrameB[2],
            &joint->localFrameAQuat[0], &joint->localFrameAQuat[1],
            &joint->localFrameAQuat[2], &joint->localFrameAQuat[3],
            &joint->localFrameBQuat[0], &joint->localFrameBQuat[1],
            &joint->localFrameBQuat[2], &joint->localFrameBQuat[3],
            &joint->hertz, &joint->dampingRatio, &joint->lowerAngle,
            &joint->upperAngle, &joint->enableSpring, &joint->releaseStep,
            &joint->releaseAngularImpulse[0], &joint->releaseAngularImpulse[1],
            &joint->releaseAngularImpulse[2], &joint->targetAngle,
            &joint->enableLimit, &joint->collideConnected);
      } else {
        jointFields = fscanf(
            input,
            "%31s %63s %15s %d %d "
            "%f %f %f %f %f %f "
            "%f %f %f %f %d %d %f %f %f",
            keyword, joint->name, joint->type, &joint->bodyA, &joint->bodyB,
            &joint->localFrameA[0], &joint->localFrameA[1],
            &joint->localFrameA[2], &joint->localFrameB[0],
            &joint->localFrameB[1], &joint->localFrameB[2], &joint->hertz,
            &joint->dampingRatio, &joint->lowerAngle, &joint->upperAngle,
            &joint->enableSpring, &joint->releaseStep,
            &joint->releaseAngularVelocity[0], &joint->releaseAngularVelocity[1],
            &joint->releaseAngularVelocity[2]);
      }
      if (((version == 3 && jointFields != 31) ||
           (version != 3 && jointFields != 20)) ||
          strcmp(keyword, "joint") != 0 ||
          strcmp(joint->type, "revolute") != 0 || joint->bodyA < 0 ||
          joint->bodyA >= bodyCount || joint->bodyB < 0 ||
          joint->bodyB >= bodyCount) {
        free(joints);
        free(bodies);
        return false;
      }
    }
  }
  *bodiesOut = bodies;
  *bodyCountOut = bodyCount;
  *jointsOut = joints;
  *jointCountOut = jointCount;
  *versionOut = version;
  return true;
}

static void WriteFrame(FILE *output, BodyInput *bodies, int bodyCount,
                       int frameIndex, int stepIndex, float timeStep,
                       bool first) {
  fprintf(output, "%s{\"index\":%d,\"time_s\":%.9g,\"entities\":{",
          first ? "" : ",", frameIndex, (double)stepIndex * timeStep);
  for (int i = 0; i < bodyCount; ++i) {
    b3Pos p = b3Body_GetPosition(bodies[i].bodyId);
    b3Quat q = b3Body_GetRotation(bodies[i].bodyId);
    fprintf(output,
            "%s\"%s\":{\"position_m\":[%.9g,%.9g,%.9g],"
            "\"orientation_xyzw\":[%.9g,%.9g,%.9g,%.9g]}",
            i == 0 ? "" : ",", bodies[i].name, (double)p.x, (double)p.y,
            (double)p.z, (double)q.v.x, (double)q.v.y, (double)q.v.z,
            (double)q.s);
  }
  fputs("}}", output);
}

static void AccumulateEvents(b3WorldId worldId, EventStats *stats) {
  b3ContactEvents contactEvents = b3World_GetContactEvents(worldId);
  b3JointEvents jointEvents = b3World_GetJointEvents(worldId);
  b3BodyEvents bodyEvents = b3World_GetBodyEvents(worldId);
  stats->contactBeginCount += contactEvents.beginCount;
  stats->contactEndCount += contactEvents.endCount;
  stats->contactHitCount += contactEvents.hitCount;
  stats->jointEventCount += jointEvents.count;
  stats->bodyMoveCount += bodyEvents.moveCount;
}

static void WriteEventFrame(FILE *output, int frameIndex, int stepIndex,
                            float timeStep, const EventStats *stats,
                            bool first) {
  fprintf(output,
          "%s{\"index\":%d,\"time_s\":%.9g,"
          "\"contact_begin_count\":%d,\"contact_end_count\":%d,"
          "\"contact_hit_count\":%d,\"joint_event_count\":%d,"
          "\"body_move_count\":%d}",
          first ? "" : ",", frameIndex, (double)stepIndex * timeStep,
          stats->contactBeginCount, stats->contactEndCount,
          stats->contactHitCount, stats->jointEventCount,
          stats->bodyMoveCount);
}

int main(int argc, char **argv) {
  if (argc != 4) {
    fprintf(stderr, "usage: %s input.b3scene output.motion.json output.b3rec\n",
            argv[0]);
    return EXIT_FAILURE;
  }
  FILE *input = fopen(argv[1], "r");
  if (input == NULL) {
    perror(argv[1]);
    return EXIT_FAILURE;
  }

  float gravity[3], timeStep, groundHeight, groundHalfExtent, groundFriction;
  float groundRestitution;
  float restitutionThreshold, hitEventThreshold, contactHertz;
  float contactDampingRatio, contactSpeed, maximumLinearSpeed;
  int worldEnableSleep, worldEnableContinuous;
  int substeps, totalSteps, sampleEvery, bodyCount;
  int jointCount, version;
  BodyInput *bodies = NULL;
  JointInput *joints = NULL;
  bool readOk =
      ReadScene(input, gravity, &timeStep, &substeps, &totalSteps, &sampleEvery,
                &groundHeight, &groundHalfExtent, &groundFriction,
                &groundRestitution, &restitutionThreshold, &hitEventThreshold,
                &contactHertz, &contactDampingRatio, &contactSpeed,
                &maximumLinearSpeed, &worldEnableSleep, &worldEnableContinuous,
                &bodies, &bodyCount, &joints, &jointCount, &version);
  fclose(input);
  if (!readOk || timeStep <= 0 || substeps <= 0 || totalSteps < 0 ||
      sampleEvery <= 0) {
    fprintf(stderr, "invalid Box3D scene input\n");
    free(bodies);
    free(joints);
    return EXIT_FAILURE;
  }

  b3WorldDef worldDef = b3DefaultWorldDef();
  worldDef.gravity = (b3Vec3){gravity[0], gravity[1], gravity[2]};
  if (version == 5) {
    worldDef.restitutionThreshold = restitutionThreshold;
    worldDef.hitEventThreshold = hitEventThreshold;
    worldDef.contactHertz = contactHertz;
    worldDef.contactDampingRatio = contactDampingRatio;
    worldDef.contactSpeed = contactSpeed;
    worldDef.maximumLinearSpeed = maximumLinearSpeed;
    worldDef.enableSleep = worldEnableSleep != 0;
    worldDef.enableContinuous = worldEnableContinuous != 0;
  }
  b3WorldId worldId = b3CreateWorld(&worldDef);

  b3BodyDef groundDef = b3DefaultBodyDef();
  groundDef.position = (b3Pos){0, groundHeight - 0.5f, 0};
  b3BodyId groundId = b3CreateBody(worldId, &groundDef);
  b3BoxHull groundHull =
      b3MakeBoxHull(groundHalfExtent, 0.5f, groundHalfExtent);
  b3ShapeDef groundShape = b3DefaultShapeDef();
  groundShape.baseMaterial.friction = groundFriction;
  groundShape.baseMaterial.restitution = groundRestitution;
  groundShape.enableContactEvents = true;
  groundShape.enableHitEvents = true;
  b3CreateHullShape(groundId, &groundShape, &groundHull.base);

  for (int i = 0; i < bodyCount; ++i) {
    BodyInput *body = bodies + i;
    b3BodyDef bodyDef = b3DefaultBodyDef();
    bodyDef.type = (b3BodyType)body->bodyType;
    bodyDef.position =
        (b3Pos){body->position[0], body->position[1], body->position[2]};
    bodyDef.rotation =
        (b3Quat){{body->rotation[0], body->rotation[1], body->rotation[2]},
                 body->rotation[3]};
    bodyDef.linearVelocity =
        (b3Vec3){body->linearVelocity[0], body->linearVelocity[1],
                 body->linearVelocity[2]};
    bodyDef.angularVelocity =
        (b3Vec3){body->angularVelocity[0], body->angularVelocity[1],
                 body->angularVelocity[2]};
    if (version == 4 || version == 5) {
      bodyDef.linearDamping = body->linearDamping;
      bodyDef.angularDamping = body->angularDamping;
      bodyDef.gravityScale = body->gravityScale;
      bodyDef.sleepThreshold = body->sleepThreshold;
      bodyDef.enableSleep = body->enableSleep != 0;
      bodyDef.isAwake = body->isAwake != 0;
      bodyDef.isBullet = body->isBullet != 0;
      bodyDef.isEnabled = body->isEnabled != 0;
      bodyDef.allowFastRotation = body->allowFastRotation != 0;
      bodyDef.enableContactRecycling = body->enableContactRecycling != 0;
      bodyDef.motionLocks.linearX = body->motionLocks[0] != 0;
      bodyDef.motionLocks.linearY = body->motionLocks[1] != 0;
      bodyDef.motionLocks.linearZ = body->motionLocks[2] != 0;
      bodyDef.motionLocks.angularX = body->motionLocks[3] != 0;
      bodyDef.motionLocks.angularY = body->motionLocks[4] != 0;
      bodyDef.motionLocks.angularZ = body->motionLocks[5] != 0;
    }
    bodyDef.name = body->name;
    body->bodyId = b3CreateBody(worldId, &bodyDef);
    b3BoxHull hull = b3MakeBoxHull(body->half[0], body->half[1], body->half[2]);
    b3ShapeDef shapeDef = b3DefaultShapeDef();
    shapeDef.density = body->density;
    shapeDef.baseMaterial.friction = body->friction;
    shapeDef.baseMaterial.restitution = body->restitution;
    shapeDef.enableContactEvents = true;
    shapeDef.enableHitEvents = true;
    b3CreateHullShape(body->bodyId, &shapeDef, &hull.base);
  }

  for (int i = 0; i < jointCount; ++i) {
    JointInput *joint = joints + i;
    b3RevoluteJointDef def = b3DefaultRevoluteJointDef();
    def.base.bodyIdA = bodies[joint->bodyA].bodyId;
    def.base.bodyIdB = bodies[joint->bodyB].bodyId;
    def.base.localFrameA =
        (b3Transform){{joint->localFrameA[0], joint->localFrameA[1],
                       joint->localFrameA[2]},
                      { {joint->localFrameAQuat[0], joint->localFrameAQuat[1],
                         joint->localFrameAQuat[2]},
                        joint->localFrameAQuat[3] }};
    def.base.localFrameB =
        (b3Transform){{joint->localFrameB[0], joint->localFrameB[1],
                       joint->localFrameB[2]},
                      { {joint->localFrameBQuat[0], joint->localFrameBQuat[1],
                         joint->localFrameBQuat[2]},
                        joint->localFrameBQuat[3] }};
    if (version != 3) {
      def.base.localFrameA.q = (b3Quat){{0.0f, 0.0f, 0.0f}, 1.0f};
      def.base.localFrameB.q = (b3Quat){{0.0f, 0.0f, 0.0f}, 1.0f};
    }
    def.base.collideConnected = version == 3 && joint->collideConnected != 0;
    def.enableSpring = joint->enableSpring != 0;
    def.hertz = joint->hertz;
    def.dampingRatio = joint->dampingRatio;
    def.targetAngle = version == 3 ? joint->targetAngle : 0.0f;
    def.enableLimit = version == 3 ? joint->enableLimit != 0 : true;
    def.lowerAngle = joint->lowerAngle;
    def.upperAngle = joint->upperAngle;
    joint->jointId = b3CreateRevoluteJoint(worldId, &def);
  }

  FILE *output = fopen(argv[2], "w");
  if (output == NULL) {
    perror(argv[2]);
    b3DestroyWorld(worldId);
    free(bodies);
    free(joints);
    return EXIT_FAILURE;
  }
  char eventsPath[2048];
  int eventsPathLength = snprintf(eventsPath, sizeof(eventsPath), "%s.events.json",
                                  argv[2]);
  if (eventsPathLength < 0 || (size_t)eventsPathLength >= sizeof(eventsPath)) {
    fprintf(stderr, "events output path is too long\n");
    fclose(output);
    b3DestroyWorld(worldId);
    free(bodies);
    free(joints);
    return EXIT_FAILURE;
  }
  FILE *eventsOutput = fopen(eventsPath, "w");
  if (eventsOutput == NULL) {
    perror(eventsPath);
    fclose(output);
    b3DestroyWorld(worldId);
    free(bodies);
    free(joints);
    return EXIT_FAILURE;
  }

  b3Recording *recording = b3CreateRecording(0);
  b3World_StartRecording(worldId, recording);
  int frameCount = totalSteps / sampleEvery + 1;
  fprintf(output,
          "{\"schema\":\"motion-clip/1\",\"space\":\"threejs_yup\","
          "\"sample_interval_s\":%.9g,\"duration_s\":%.9g,\"frames\":[",
          (double)timeStep * sampleEvery, (double)timeStep * totalSteps);
  fprintf(eventsOutput,
          "{\"schema\":\"simulation-events/1\","
          "\"sample_interval_s\":%.9g,\"duration_s\":%.9g,\"frames\":[",
          (double)timeStep * sampleEvery, (double)timeStep * totalSteps);
  WriteFrame(output, bodies, bodyCount, 0, 0, timeStep, true);
  EventStats eventStats = {0};
  WriteEventFrame(eventsOutput, 0, 0, timeStep, &eventStats, true);
  int frameIndex = 1;
  for (int stepIndex = 1; stepIndex <= totalSteps; ++stepIndex) {
    for (int i = 0; i < jointCount; ++i) {
      JointInput *joint = joints + i;
      if (joint->releaseStep == stepIndex) {
        b3RevoluteJoint_EnableSpring(joint->jointId, false);
        b3Joint_WakeBodies(joint->jointId);
        b3Body_SetAwake(bodies[joint->bodyB].bodyId, true);
        if (version == 3) {
          b3Body_ApplyAngularImpulse(
              bodies[joint->bodyB].bodyId,
              (b3Vec3){joint->releaseAngularImpulse[0],
                       joint->releaseAngularImpulse[1],
                       joint->releaseAngularImpulse[2]},
              true);
        } else {
          b3Body_SetAngularVelocity(
              bodies[joint->bodyB].bodyId,
              (b3Vec3){joint->releaseAngularVelocity[0],
                       joint->releaseAngularVelocity[1],
                       joint->releaseAngularVelocity[2]});
        }
      }
    }
    b3World_Step(worldId, timeStep, substeps);
    AccumulateEvents(worldId, &eventStats);
    if (stepIndex % sampleEvery == 0) {
      WriteFrame(output, bodies, bodyCount, frameIndex, stepIndex, timeStep,
                 false);
      WriteEventFrame(eventsOutput, frameIndex, stepIndex, timeStep,
                      &eventStats, false);
      frameIndex += 1;
    }
  }
  fputs("]}\n", output);
  fputs("]}\n", eventsOutput);
  fclose(output);
  fclose(eventsOutput);
  b3World_StopRecording(worldId);

  bool saved = b3SaveRecordingToFile(recording, argv[3]);
  bool replayValid = b3ValidateReplay(b3Recording_GetData(recording),
                                      b3Recording_GetSize(recording), 1);
  fprintf(stderr, "frames=%d bodies=%d joints=%d recording_bytes=%d replay=%s\n",
          frameCount, bodyCount, jointCount, b3Recording_GetSize(recording),
          replayValid ? "valid" : "diverged");
  b3DestroyRecording(recording);
  b3DestroyWorld(worldId);
  free(bodies);
  free(joints);
  return saved && replayValid && frameIndex == frameCount ? EXIT_SUCCESS
                                                          : EXIT_FAILURE;
}

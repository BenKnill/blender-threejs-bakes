cmake_minimum_required(VERSION 3.20)
project(blender_threejs_box3d_runner LANGUAGES C)

set(BOX3D_SOURCE_DIR "/Users/boxer/box3d" CACHE PATH "Path to a Box3D checkout")
set(BOX3D_SAMPLES OFF CACHE BOOL "" FORCE)
set(BOX3D_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(BOX3D_DOCS OFF CACHE BOOL "" FORCE)

if(NOT EXISTS "${BOX3D_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "BOX3D_SOURCE_DIR is not a Box3D checkout: ${BOX3D_SOURCE_DIR}")
endif()

add_subdirectory("${BOX3D_SOURCE_DIR}" box3d EXCLUDE_FROM_ALL)
add_executable(box3d_scene_runner box3d_scene_runner.c)
target_link_libraries(box3d_scene_runner PRIVATE box3d::box3d)
set_target_properties(box3d_scene_runner PROPERTIES C_STANDARD 17 C_STANDARD_REQUIRED YES)

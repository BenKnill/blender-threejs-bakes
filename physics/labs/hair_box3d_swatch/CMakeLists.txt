cmake_minimum_required(VERSION 3.22)

project(hair_box3d_swatch LANGUAGES C)

set(BOX3D_SOURCE_DIR "/Users/boxer/box3d" CACHE PATH "Path to a Box3D checkout")
set(BOX3D_SAMPLES OFF CACHE BOOL "" FORCE)
set(BOX3D_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(BOX3D_DOCS OFF CACHE BOOL "" FORCE)

if(NOT EXISTS "${BOX3D_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "BOX3D_SOURCE_DIR is not a Box3D checkout: ${BOX3D_SOURCE_DIR}")
endif()

add_subdirectory("${BOX3D_SOURCE_DIR}" box3d EXCLUDE_FROM_ALL)

add_executable(hair_box3d_swatch hair_box3d_swatch.c hair_stiction.c)
target_compile_features(hair_box3d_swatch PRIVATE c_std_17)
target_compile_options(hair_box3d_swatch PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(hair_box3d_swatch PRIVATE box3d::box3d m)

include(CTest)
if(BUILD_TESTING)
  add_test(NAME hair_box3d_swatch_self_test COMMAND hair_box3d_swatch --self-test)
endif()

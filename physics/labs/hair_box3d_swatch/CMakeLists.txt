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

function(configure_hair_box3d_target target)
  target_compile_features(${target} PRIVATE c_std_17)
  target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
  target_link_libraries(${target} PRIVATE box3d::box3d m)
endfunction()

add_executable(hair_box3d_swatch hair_box3d_swatch.c hair_stiction.c)
configure_hair_box3d_target(hair_box3d_swatch)

add_executable(hair_box3d_scalp_groom_64 hair_box3d_swatch.c hair_stiction.c)
target_compile_definitions(
  hair_box3d_scalp_groom_64 PRIVATE
  HAIR_GUIDE_SIDE=8
  HAIR_SCALP_GROOM=1
  HAIR_HEAD_PROXY=0
  HAIR_EXPECTED_BASELINE_DIGEST=0x20f33acee3034e97ULL
  HAIR_OUTPUT_BASENAME="hair_box3d_scalp_groom_64"
  HAIR_MOTION_PATH="outputs/hair_box3d_scalp_groom_64_motion.csv"
  HAIR_RECEIPT_PATH="outputs/hair_box3d_scalp_groom_64_receipt.json"
)
configure_hair_box3d_target(hair_box3d_scalp_groom_64)

add_executable(hair_box3d_scalp_groom_256 hair_box3d_swatch.c hair_stiction.c)
target_compile_definitions(
  hair_box3d_scalp_groom_256 PRIVATE
  HAIR_GUIDE_SIDE=16
  HAIR_SCALP_GROOM=1
  HAIR_HEAD_PROXY=0
  HAIR_EXPECTED_BASELINE_DIGEST=0xe513903a4039c43cULL
  HAIR_OUTPUT_BASENAME="hair_box3d_scalp_groom_256"
  HAIR_MOTION_PATH="outputs/hair_box3d_scalp_groom_256_motion.csv"
  HAIR_RECEIPT_PATH="outputs/hair_box3d_scalp_groom_256_receipt.json"
)
configure_hair_box3d_target(hair_box3d_scalp_groom_256)

include(CTest)
if(BUILD_TESTING)
  add_test(NAME hair_box3d_swatch_self_test COMMAND hair_box3d_swatch --self-test)
  add_test(NAME hair_box3d_scalp_groom_64_self_test COMMAND hair_box3d_scalp_groom_64 --self-test)
endif()

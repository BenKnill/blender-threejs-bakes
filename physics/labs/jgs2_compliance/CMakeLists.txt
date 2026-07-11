cmake_minimum_required(VERSION 3.22)

project(jgs2_compliance_lab LANGUAGES C)

set(BOX3D_SOURCE_DIR "/Users/boxer/box3d" CACHE PATH "Path to a Box3D checkout")
set(BOX3D_SAMPLES OFF CACHE BOOL "" FORCE)
set(BOX3D_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(BOX3D_DOCS OFF CACHE BOOL "" FORCE)

if(NOT EXISTS "${BOX3D_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "BOX3D_SOURCE_DIR is not a Box3D checkout: ${BOX3D_SOURCE_DIR}")
endif()

add_subdirectory("${BOX3D_SOURCE_DIR}" box3d EXCLUDE_FROM_ALL)

add_library(chain_quadratic STATIC chain_quadratic.c)
target_compile_features(chain_quadratic PUBLIC c_std_17)
target_compile_options(chain_quadratic PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(chain_quadratic PUBLIC m)

add_executable(compliance_chain compliance_chain.c)
target_compile_features(compliance_chain PRIVATE c_std_17)
target_compile_options(compliance_chain PRIVATE -Wall -Wextra -Wpedantic)
target_link_libraries(compliance_chain PRIVATE chain_quadratic box3d::box3d)

include(CTest)
if(BUILD_TESTING)
  add_test(NAME compliance_chain_self_test COMMAND compliance_chain --self-test)
endif()

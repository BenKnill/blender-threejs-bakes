cmake_minimum_required(VERSION 3.22)

project(box3d_contact_shell_lab LANGUAGES C)

set(BOX3D_SOURCE_DIR "/Users/boxer/box3d" CACHE PATH "Path to a Box3D checkout")
set(BOX3D_SAMPLES OFF CACHE BOOL "" FORCE)
set(BOX3D_UNIT_TESTS OFF CACHE BOOL "" FORCE)
set(BOX3D_DOCS OFF CACHE BOOL "" FORCE)

if(NOT EXISTS "${BOX3D_SOURCE_DIR}/CMakeLists.txt")
  message(FATAL_ERROR "BOX3D_SOURCE_DIR is not a Box3D checkout: ${BOX3D_SOURCE_DIR}")
endif()

add_subdirectory("${BOX3D_SOURCE_DIR}" box3d EXCLUDE_FROM_ALL)

add_library(contact_shell STATIC contact_shell.c)
target_compile_features(contact_shell PUBLIC c_std_17)
target_compile_options(contact_shell PRIVATE -Wall -Wextra -Wpedantic -Werror)
target_link_libraries(contact_shell PUBLIC m)

add_executable(contact_shell_probe contact_shell_probe.c)
target_compile_features(contact_shell_probe PRIVATE c_std_17)
target_compile_options(contact_shell_probe PRIVATE -Wall -Wextra -Wpedantic -Werror)
target_link_libraries(contact_shell_probe PRIVATE contact_shell box3d::box3d)

include(CTest)
if(BUILD_TESTING)
  add_test(NAME contact_shell_self_test COMMAND contact_shell_probe --self-test)
endif()

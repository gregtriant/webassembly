cmake_minimum_required(VERSION 3.16)
project(wx_test LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(wxWidgets REQUIRED COMPONENTS core base)

add_executable(wx_test main.cpp)

target_link_libraries(wx_test PRIVATE wxWidgets::wxWidgets)
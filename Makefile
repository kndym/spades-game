# Compiler
CXX = g++

# Compiler flags
CXXFLAGS = -std=c++17 -Wall -Iinclude

# Directories
SRCDIR = src
INCDIR = include
BUILDDIR = build

# On Windows, executables usually have a .exe extension.
# We define it here to make the script more robust.
TARGET = spades.exe

# Find all .cpp files in src directory
SRCS = $(wildcard $(SRCDIR)/*.cpp)
# Create object file names by replacing src/%.cpp with build/%.o
OBJS = $(patsubst $(SRCDIR)/%.cpp,$(BUILDDIR)/%.o,$(SRCS))

# The default goal
all: $(TARGET)

# Link the executable
$(TARGET): $(OBJS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(OBJS)

# Compile source files into object files
$(BUILDDIR)/%.o: $(SRCDIR)/%.cpp
# Windows cmd.exe does not understand "mkdir -p".
# This command checks if the directory exists and creates it only if it doesn't.
	@if not exist $(BUILDDIR) mkdir $(BUILDDIR)
	$(CXX) $(CXXFLAGS) -c $< -o $@

# Clean up build files
clean:
# Windows uses 'del' to delete files and 'rmdir' to remove directories.
# The '-' prefix tells make to ignore errors (e.g., if the file doesn't exist).
	-del /q $(TARGET)
	-if exist $(BUILDDIR) rmdir /s /q $(BUILDDIR)

# Phony targets
.PHONY: all clean



#include <iostream>
#include <fcntl.h> // For _O_U16TEXT
#include <io.h>    // For _setmode and _fileno

int main() {
    _setmode(_fileno(stdout), _O_U16TEXT);
    std::wcout << L'\u2665' << std::endl;
    std::wcout << typeid("ddd").name() << std::endl;
    std::wcout << "Hello, world!" << std::endl;
    return 0;
}
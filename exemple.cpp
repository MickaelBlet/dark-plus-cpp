#include <iostream>

struct Custom {
    int child;
};

int main(int argc, char **argv) {
    Custom newType; // Type

    newType.child = 42;
    std::cout << "Namespace and child: " << newType.child << std::endl;
    std::cout << argv[0] << ": number of param: " << argc << std::endl;
    return 0;
}

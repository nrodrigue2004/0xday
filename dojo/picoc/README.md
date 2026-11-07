# picoc.wasm

The C katas in `~/dojo` run on [picoc](https://github.com/jpoirier/picoc) (BSD license, see `LICENSE`), a small C interpreter, compiled to WebAssembly with clang and wasi-libc. `../picoc-wasi.js` is the tiny WASI host that feeds it one file (`/main.c`) and collects stdout.

`picoc-wasm.patch` (against upstream commit a97d94f) makes it build and behave on wasm32:

- no readline, signals, `unistd.h` or `setjmp`; exit and errors go through `proc_exit`, which the JS host turns into a throw
- 8 MB interpreter stack
- integer math is done in 64 bits so `unsigned int` values above `INT_MAX` keep their sign (wasm32 `long` is 32-bit), `>>` is logical on unsigned operands, and results of mixed unsigned math stay unsigned
- integer literals above `INT_MAX` (`0xDEADBEEF`, `2166136261`) are typed unsigned
- chained ternaries `a ? b : c ? d : e` nest to the right like real C

Rebuild with `./build.sh`. Known gaps that the katas avoid: function pointers, pointer subtraction, anonymous structs and several fields declared on one line in a struct.

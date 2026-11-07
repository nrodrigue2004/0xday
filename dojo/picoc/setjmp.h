/* wasm shim: no real setjmp. Exits go through proc_exit, which the JS host turns into a throw. */
#ifndef WASM_SETJMP_SHIM
#define WASM_SETJMP_SHIM
typedef int jmp_buf[1];
#define setjmp(b) 0
#define longjmp(b, v) _Exit(1)
#endif

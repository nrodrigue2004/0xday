#!/bin/sh
# Rebuilds ../picoc.wasm from upstream picoc plus picoc-wasm.patch.
# Needs clang + wasm-ld and a wasi sysroot (Ubuntu: apt install clang lld wasi-libc libclang-rt-18-dev-wasm32).
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$(mktemp -d)
git clone -q https://github.com/jpoirier/picoc "$WORK/src"
cd "$WORK/src"
git checkout -q a97d94fa3d4d35c6b78b7de69faac7643e34de22
git apply "$HERE/picoc-wasm.patch"
mkdir -p ../inc && cp "$HERE/setjmp.h" "$HERE/wasm_stubs.c" ../inc/
clang --target=wasm32-wasi --sysroot=/usr -isystem ../inc -I/usr/include/wasm32-wasi -L/usr/lib/wasm32-wasi \
  -O2 -std=gnu11 -DUNIX_HOST -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -Wno-everything \
  picoc.c table.c lex.c parse.c expression.c heap.c type.c variable.c clibrary.c platform.c include.c debug.c \
  platform/platform_unix.c platform/library_unix.c cstdlib/stdio.c cstdlib/math.c cstdlib/string.c \
  cstdlib/stdlib.c cstdlib/time.c cstdlib/errno.c cstdlib/ctype.c cstdlib/stdbool.c ../inc/wasm_stubs.c \
  -o "$HERE/../picoc.wasm" -lm -lwasi-emulated-signal -lwasi-emulated-process-clocks \
  -Wl,--strip-all -Wl,-z,stack-size=4194304
echo "wrote $(cd "$HERE/.." && pwd)/picoc.wasm"

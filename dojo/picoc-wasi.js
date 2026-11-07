/* Tiny WASI host for picoc.wasm (a C interpreter compiled to WebAssembly).
   Gives the program one read-only file (/main.c), stdout/stderr callbacks and nothing else.
   Exit (or any fatal error) becomes a thrown WasiExit. Works in a Worker and in Node. */
(function (root) {
  class WasiExit extends Error { constructor(code) { super("exit " + code); this.code = code; } }
  const enc = new TextEncoder(), dec = new TextDecoder();

  function runPicoc(module, source, onOut) {
    const file = enc.encode(source);
    const files = {};               // fd -> {pos}
    let mem;
    const view = () => new DataView(mem.buffer);
    const u8 = () => new Uint8Array(mem.buffer);
    const args = ["picoc", "main.c"];
    const ENOSYS = 52, EBADF = 8, ENOENT = 44;

    const iov = (ptr, n, fn) => { let t = 0; const v = view(); for (let i = 0; i < n; i++) { const b = v.getUint32(ptr + i * 8, true), l = v.getUint32(ptr + i * 8 + 4, true); const k = fn(b, l); t += k; if (k < l) break; } return t; };
    const strAt = (p, l) => dec.decode(u8().subarray(p, p + l));

    const wasi = {
      args_sizes_get(c, s) { const v = view(); v.setUint32(c, args.length, true); v.setUint32(s, args.reduce((a, x) => a + enc.encode(x).length + 1, 0), true); return 0; },
      args_get(argv, buf) { const v = view(), m = u8(); args.forEach(a => { v.setUint32(argv, buf, true); argv += 4; const b = enc.encode(a); m.set(b, buf); m[buf + b.length] = 0; buf += b.length + 1; }); return 0; },
      environ_sizes_get(c, s) { const v = view(); v.setUint32(c, 0, true); v.setUint32(s, 0, true); return 0; },
      environ_get() { return 0; },
      clock_time_get(id, prec, out) { view().setBigUint64(out, BigInt(Math.round(performance.now() * 1e6)), true); return 0; },
      fd_write(fd, ptr, n, out) {
        const w = iov(ptr, n, (b, l) => { if (fd === 1 || fd === 2) onOut(strAt(b, l), fd); return l; });
        view().setUint32(out, w, true); return fd === 1 || fd === 2 ? 0 : EBADF;
      },
      fd_read(fd, ptr, n, out) {
        const f = files[fd]; if (!f) { view().setUint32(out, 0, true); return fd === 0 ? 0 : EBADF; }
        const r = iov(ptr, n, (b, l) => { const k = Math.min(l, file.length - f.pos); u8().set(file.subarray(f.pos, f.pos + k), b); f.pos += k; return k; });
        view().setUint32(out, r, true); return 0;
      },
      fd_seek(fd, off, wh, out) { const f = files[fd]; if (!f) return EBADF; const o = Number(off); f.pos = wh === 0 ? o : wh === 1 ? f.pos + o : file.length + o; view().setBigUint64(out, BigInt(f.pos), true); return 0; },
      fd_close(fd) { delete files[fd]; return 0; },
      fd_fdstat_get(fd, out) {
        const v = view(); if (fd > 4) return EBADF;
        v.setUint8(out, fd === 3 ? 3 : fd <= 2 ? 2 : 4); v.setUint16(out + 2, 0, true);
        v.setBigUint64(out + 8, 0xffffffffn, true); v.setBigUint64(out + 16, 0xffffffffn, true); return 0;
      },
      fd_fdstat_set_flags() { return 0; },
      fd_prestat_get(fd, out) { if (fd !== 3) return EBADF; const v = view(); v.setUint8(out, 0); v.setUint32(out + 4, 1, true); return 0; },
      fd_prestat_dir_name(fd, p, l) { if (fd !== 3) return EBADF; u8()[p] = 47; return 0; },
      path_filestat_get(fd, fl, p, l, out) {
        if (strAt(p, l).replace(/^\/+/, "") !== "main.c") return ENOENT;
        const v = view(); for (let i = 0; i < 64; i += 8) v.setBigUint64(out + i, 0n, true);
        v.setUint8(out + 16, 4); v.setBigUint64(out + 32, BigInt(file.length), true); return 0;
      },
      path_open(dirfd, df, p, l, oflags, rb, ri, ff, out) {
        if (strAt(p, l).replace(/^\/+/, "") !== "main.c") return ENOENT;
        const fd = 4; files[fd] = { pos: 0 }; view().setUint32(out, fd, true); return 0;
      },
      proc_exit(code) { throw new WasiExit(code); },
      fd_renumber() { return ENOSYS }, path_remove_directory() { return ENOSYS }, path_rename() { return ENOSYS }, path_unlink_file() { return ENOSYS },
    };
    const inst = new WebAssembly.Instance(module, { wasi_snapshot_preview1: wasi });
    mem = inst.exports.memory;
    try { inst.exports._start(); return 0; }
    catch (e) { if (e instanceof WasiExit) return e.code; throw e; }
  }
  root.runPicoc = runPicoc;
  if (typeof module !== "undefined") module.exports = { runPicoc };
})(typeof self !== "undefined" ? self : globalThis);

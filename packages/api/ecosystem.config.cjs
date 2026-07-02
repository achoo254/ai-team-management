// PM2 process config for the bundled API (dist/index.js → deployed as index.js).
// Deploy: copy this file next to the built index.js, then `pm2 start ecosystem.config.cjs`
// (or `pm2 reload`). CommonJS (.cjs) because the package is ESM.
//
// Memory settings exist because the process was holding ~1.1GB RSS (peaking 1.66GB)
// on a shared 7.6GB host that also runs mongod — driving the box into swap:
//   - max_memory_restart: PM2 gracefully restarts the process past this RSS, so
//     V8/glibc memory that is freed-but-not-returned-to-OS gets reclaimed instead
//     of ratcheting up to a high-water mark and staying there.
//   - NODE_OPTIONS=--max-old-space-size: hard-caps the V8 old heap as a backstop
//     below the restart threshold (native firebase-admin/gRPC adds ~200MB on top).
//     Set via NODE_OPTIONS, not node_args: PM2 fork mode does not apply node_args
//     to the interpreter, but node always honors NODE_OPTIONS at startup.
//   - MALLOC_ARENA_MAX: glibc defaults to 8×CPU malloc arenas for a threaded
//     process, which massively inflates anonymous RSS; 2 keeps fragmentation low.
//   - NODE_ENV=production: enables Express/Mongoose production code paths.
module.exports = {
  apps: [
    {
      name: 'ai',
      script: './index.js',
      exec_mode: 'fork',
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
        MALLOC_ARENA_MAX: '2',
        NODE_OPTIONS: '--max-old-space-size=640',
      },
    },
  ],
}

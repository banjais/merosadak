import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

/** True when `id` is a file inside `node_modules/<pkg>/`. */
function isPackage(id: string, pkg: string): boolean {
  return (
    id.includes(`node_modules${path.sep}${pkg}${path.sep}`) ||
    id.includes(`node_modules/${pkg}/`)
  );
}

/**
 * Heavy libraries that only lazily-loaded routes need. Excluded from the
 * shared vendor chunk so they are fetched on demand instead of on first paint.
 */
const ON_DEMAND_PACKAGES = [
  'three',        // 3D depth-map viewer
  '@react-three', // react-three-fiber / drei
  'jspdf',        // proof sheet PDF
  'qrcode',       // proof sheet QR
  'html2canvas',  // jspdf rasterisation
  'dompurify',    // sanitiser used alongside the PDF path
  'canvg',        // jspdf SVG support
];

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          // Split React into its own chunk, and keep heavy on-demand libraries
          // out of the shared vendor chunk. Forcing them into a named chunk (or
          // letting the catch-all grab them) makes the eagerly-loaded entry
          // depend on hundreds of kB of code that only lazily-loaded pages need.
          // Those return undefined, so Rollup places them with whichever lazy
          // entry actually imports them.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/.test(id)) {
              return 'vendor-react';
            }
            if (ON_DEMAND_PACKAGES.some((pkg) => isPackage(id, pkg))) return undefined;
            return 'vendor';
          },
        },
      },
    },
  };
});

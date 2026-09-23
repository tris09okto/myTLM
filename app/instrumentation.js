export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err: Error & { message?: string }) => {
      if (err?.message && err.message.includes('Server is not running')) {
        // Abaikan error net.Server close palsu dari environment hosting
        return;
      }
      // Jangan gunakan process.exit() agar proses tidak mati total
      console.error('Captured Uncaught Exception:', err);
    });
  }
}
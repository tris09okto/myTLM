export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err) => {
      if (err && typeof err.message === 'string' && err.message.includes('Server is not running')) {
        return;
      }
    });
  }
}
import { build } from 'vite';

// Explicit release entry point. Ordinary builds remain isolated previews.
process.env.VITE_APP_ENV = 'production';
process.env.VITE_API_BASE_URL = 'https://panini-swap-production-69ef.up.railway.app/api';
process.env.VITE_COLLECTION_SHARING = 'true';
await build();

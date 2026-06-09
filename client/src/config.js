// Base URL for the restaurant POS backend server.
// Falls back to localhost:4000 if VITE_API_URL environment variable is not defined.
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const API_URL = rawApiUrl.replace(/\/$/, ''); // Remove trailing slash if present

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'ap_memory_agent_super_secret_jwt_key_2026',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  hindsightApiKey: process.env.HINDSIGHT_API_KEY || '',
  hindsightBaseUrl: process.env.HINDSIGHT_BASE_URL || 'https://api.hindsight.vectorize.io',
};

export function updateConfig(newConfig: Partial<typeof config>) {
  if (newConfig.groqApiKey !== undefined) config.groqApiKey = newConfig.groqApiKey;
  if (newConfig.groqModel !== undefined) config.groqModel = newConfig.groqModel;
  if (newConfig.hindsightApiKey !== undefined) config.hindsightApiKey = newConfig.hindsightApiKey;
  if (newConfig.hindsightBaseUrl !== undefined) config.hindsightBaseUrl = newConfig.hindsightBaseUrl;
}

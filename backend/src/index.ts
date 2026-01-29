import { env } from './config/env';
import { app } from './app';
import { logger } from './config/logger';

const PORT = Number(env.PORT) || 3001;

app.listen(PORT, () => {
    logger.info(`🚀 LegalFlow Backend running on port ${PORT}`);
    logger.info(`📝 Environment: ${env.NODE_ENV}`);
});

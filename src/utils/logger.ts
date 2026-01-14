/**
 * Logger utilitaire pour gérer les logs en dev/prod
 * Évite les console.log en production tout en gardant les erreurs pour Sentry
 */

type LogContext = Record<string, any>;

class AppLogger {
  private readonly isDev = import.meta.env.DEV;

  /**
   * Logs de développement uniquement
   * Sera supprimé en production
   */
  dev(message: string, context?: LogContext) {
    if (this.isDev) {
      console.log(`[DEV] ${message}`, context || '');
    }
  }

  /**
   * Informations importantes (gardées en prod)
   */
  info(message: string, context?: LogContext) {
    console.info(`[INFO] ${message}`, context || '');
  }

  /**
   * Avertissements (gardés en prod)
   */
  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context || '');
  }

  /**
   * Erreurs (toujours logguées + Sentry en prod)
   */
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(`[ERROR] ${message}`, error, context || '');
    
    // TODO: Intégrer Sentry en production
    // if (!this.isDev && typeof window !== 'undefined') {
    //   Sentry.captureException(error, { extra: { message, ...context } });
    // }
  }

  /**
   * Debug détaillé (dev uniquement)
   */
  debug(tag: string, data: any) {
    if (this.isDev) {
      console.log(`[DEBUG][${tag}]`, data);
    }
  }

  /**
   * Trace pour suivre le flow (dev uniquement)
   */
  trace(tag: string, message: string) {
    if (this.isDev) {
      console.trace(`[TRACE][${tag}] ${message}`);
    }
  }
}

export const logger = new AppLogger();

// Export du type pour TypeScript
export type { LogContext };

type LogData = unknown;

export class Logger {
  private static formatMessage(level: string, scope: string, action: string, data: LogData): string {
    const timestamp = new Date().toISOString();
    const formattedData = data !== undefined ? Logger.stringify(data) : "";
    return `[${timestamp}] [${scope}] ${level} ${action}\n${formattedData}`;
  }

  private static stringify(data: LogData): string {
    if (typeof data === "string") return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }

  static info(scope: string, action: string, data: LogData = undefined): void {
    console.log(`\x1b[34mℹ️ ${Logger.formatMessage("INFO", scope, action, data)}\x1b[0m`);
  }

  static success(scope: string, action: string, data: LogData = undefined): void {
    console.log(`\x1b[32m✅ ${Logger.formatMessage("SUCCESS", scope, action, data)}\x1b[0m`);
  }

  static warn(scope: string, action: string, data: LogData = undefined): void {
    console.warn(`\x1b[33m⚠️ ${Logger.formatMessage("WARN", scope, action, data)}\x1b[0m`);
  }

  static error(scope: string, action: string, data: LogData = undefined): void {
    console.error(`\x1b[31m❌ ${Logger.formatMessage("ERROR", scope, action, data)}\x1b[0m`);
  }

  static debug(scope: string, action: string, data: LogData = undefined): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(`\x1b[36m🐛 ${Logger.formatMessage("DEBUG", scope, action, data)}\x1b[0m`);
    }
  }
}

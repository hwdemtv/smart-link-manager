import fs from "fs";
import path from "path";

// 确保日志目录存在
const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getLogFileName(type: "application" | "error") {
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(logDir, `${type}-${dateStr}.log`);
}

function formatLog(level: string, message: string, meta?: any) {
  // 生成可读的本地时间戳格式 YYYY-MM-DD HH:mm:ss
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  const localIso = new Date(Date.now() - tzOffset)
    .toISOString()
    .replace("T", " ")
    .substring(0, 19);

  let logStr = `[${localIso}] ${level.toUpperCase()}: ${message}`;

  if (meta) {
    if (meta instanceof Error) {
      logStr += `\n${meta.stack}`;
    } else if (typeof meta === "object" && Object.keys(meta).length > 0) {
      logStr += ` ${JSON.stringify(meta)}`;
    } else if (typeof meta !== "object") {
      logStr += ` ${meta}`;
    }
  }
  return logStr + "\n";
}

// 异步追加写入避免阻塞主线程
function writeLog(type: "application" | "error", logStr: string) {
  const file = getLogFileName(type);
  fs.appendFile(file, logStr, err => {
    if (err) console.error("❌ 原生 Logger 写入硬盘失败:", err);
  });
}

// ============================================================================
// 零依赖高性能全局记录器 (In-Memory File Logger)
// ============================================================================
export const logger = {
  info: (message: string, meta?: any) => {
    const logStr = formatLog("info", message, meta);
    console.log(logStr.trimEnd());
    writeLog("application", logStr);
  },
  warn: (message: string, meta?: any) => {
    const logStr = formatLog("warn", message, meta);
    console.warn("\x1b[33m%s\x1b[0m", logStr.trimEnd()); // 黄色展示
    writeLog("application", logStr);
  },
  error: (message: string, meta?: any) => {
    const logStr = formatLog("error", message, meta);
    console.error("\x1b[31m%s\x1b[0m", logStr.trimEnd()); // 红色展示
    writeLog("application", logStr);
    writeLog("error", logStr); // 错误日志池单独保存一份
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV !== "production") {
      const logStr = formatLog("debug", message, meta);
      console.debug("\x1b[36m%s\x1b[0m", logStr.trimEnd()); // 青色展示
    }
  },
};

// 暴露流接口以适配极个别依赖 Stream 的第三方包
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

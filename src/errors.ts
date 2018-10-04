export class MultipleCounterError extends Error {
  constructor() {
    super("multiple counters with the same name");
  }
}

export class NetError extends Error {
  constructor(message: string, code?: number) {
    super(`${message}: ${code}`);
  }
}

export class ReportError extends NetError {
  constructor(errorCode?: number) {
    super("Stats reporting failure", errorCode);
  }
}

export class PingError extends NetError {
  constructor(errorCode?: number) {
    super("Error sending opt in ping", errorCode);
  }
}

export class MultipleCounterError extends Error {
  constructor() {
    super("multiple counters with the same name");
  }
}
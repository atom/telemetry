export interface ISettings {
  getItem(key: string): string | undefined;
  setItem(key: string, value: string): void;
}

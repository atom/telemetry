export interface IStorage {
  getItem(key: string): string | undefined;
  setItem(key: string, value: string): void;
}

export class LocalStorage implements IStorage {
  public getItem(key: string): string | undefined {
    return localStorage.getItem(key) || undefined;
  }

  public setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
}
import { IStorage } from "./interfaces";

export class LocalStorage implements IStorage {
  public getItem(key: string): string | undefined {
    return localStorage.getItem(key) || undefined;
  }

  public setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
}

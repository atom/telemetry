import { ISettings } from "./interfaces";

export class LocalStorage implements ISettings {
  public getItem(key: string): string | undefined {
    return localStorage.getItem(key) || undefined;
  }

  public setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }
}

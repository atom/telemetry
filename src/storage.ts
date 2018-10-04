import { ISettings } from "telemetry-github";

export class LocalStorage implements ISettings {
  public getItem(key: string): Promise<string | undefined> {
    return Promise.resolve(localStorage.getItem(key) || undefined);
  }

  public setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
    return Promise.resolve();
  }
}

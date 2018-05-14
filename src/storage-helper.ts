// module with classes and logic for working with local storage in browsers via JavaScript
// copied wholesale from https://gist.github.com/Digiman/9fc2640b84bbe5162cf1
export interface IStorageItem {
    key: string;
    value: any;
}

export class StorageItem {
    key: string;
    value: any;

    constructor(data: IStorageItem) {
        this.key = data.key;
        this.value = data.value;
    }
}

// class for working with local storage in browser (common that can use other classes for store some data)
export class LocalStorageWorker {
    localStorageSupported: boolean;

    constructor() {
        this.localStorageSupported = typeof window['localStorage'] != "undefined" && window['localStorage'] != null;
    }

    // add value to storage
    add(key: string, item: string) {
        if (this.localStorageSupported) {
            localStorage.setItem(key, item);
        }
    }

    // get one item by key from storage
    getItem(key: string): string | null {
        if (this.localStorageSupported) {
            var item = localStorage.getItem(key);
            return item;
        } else {
            return null;
        }
    }

    // remove value from storage
    remove(key: string) {
        if (this.localStorageSupported) {
            localStorage.removeItem(key);
        }
    }

    // clear storage (remove all items from it)
    clear() {
        if (this.localStorageSupported) {
            localStorage.clear();
        }
    }
}

// custom class for store emails in local storage
export class EmailStorage {
    storageWorker: LocalStorageWorker;

    // main key that use for store list of emails
    storageKey: string;

    // list of emails
    addresses: Array<string>;

    constructor(storageKey: string) {
        this.storageWorker = new LocalStorageWorker();

        this.storageKey = storageKey;

        this.addresses = new Array<string>();

        this.activate();
    }

    // activate custom storage for emails
    activate() {
        //this.clear();
        this.loadAll();
    }

    // load all emails from storage to list for working with it
    loadAll() {
        var storageData = this.storageWorker.getItem(this.storageKey);

        if (storageData != null && storageData.length > 0) {
            var emails = JSON.parse(storageData);
            console.log(emails);
            if (emails != null) {
                this.addresses = emails;
            }
            console.log(this.addresses);
        }
    }

    // add new email (without duplicate)
    addEmail(email: string) {
        if (email.length > 0) {

            // 1. Split email addresses if needed (if we get list of emails)
            var mas = email.split(/,|;/g);
            //console.log(mas);
            // 2. Add each email in the splited list
            for (var i = 0; i < mas.length; i++) {
                // check if not exist and not add new (duplicate)
                var index = this.addresses.indexOf(mas[i].trim());
                if (index < 0) {
                    this.addresses.push(mas[i].trim());
                }
            }

            console.log(this.addresses);

            // 3. save to storage
            this.save();
        }
    }

    // clear all data about emails
    clear() {
        // remove data by key from storage
        this.storageWorker.add(this.storageKey, "");

        // or remove with key
        //this.storageWorker.remove(this.storageKey);
    }

    // save to storage (save as JSON string)
    save() {
        var jsonEmails = JSON.stringify(this.addresses);
        this.storageWorker.add(this.storageKey, jsonEmails);
    }
}
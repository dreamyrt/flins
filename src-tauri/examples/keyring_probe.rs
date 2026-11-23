// src-tauri/examples/keyring_probe.rs
// Повний round-trip через нативне сховище: set -> get -> delete.
// Якщо тут "No matching entry" після успішного set — сховище не постійне (див. урок 2026-11-23).
use keyring::Entry;

fn main() {
    let e = Entry::new("com.flins.app", "flins-db-key").expect("entry");

    // 1. Чи є вже ключ?
    match e.get_password() {
        Ok(k) => println!("EXISTING KEY (len {}): {}...", k.len(), &k[..8]),
        Err(keyring::Error::NoEntry) => println!("get: NoEntry (clean slate)"),
        Err(other) => println!("get ERR: {other}"),
    }

    // 2. set -> get round-trip
    let probe_key = "PROBE-KEY-1234567890abcdef";
    if let Err(err) = e.set_password(probe_key) {
        println!("SET ERR: {err}");
        return;
    }
    println!("set: Ok");
    match e.get_password() {
        Ok(k) if k == probe_key => println!("read-back: MATCH (store is persistent)"),
        Ok(k) => println!("read-back: MISMATCH!? {k}"),
        Err(err) => println!("read-back ERR: {err}"),
    }

    // 3. прибираємо за собою
    match e.delete_credential() {
        Ok(()) => println!("delete: Ok"),
        Err(err) => println!("delete ERR: {err}"),
    }
}

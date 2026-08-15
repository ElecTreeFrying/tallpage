import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/**
 * What `storage.defineItem()` returns, typed by shape rather than by importing
 * WXT's own type — so this keeps compiling across WXT releases.
 */
export interface StorageItemLike<T> {

  getValue(): Promise<T>;

  setValue(value: T): Promise<void>;

  watch(callback: (newValue: T) => void): () => void;

}

/**
 * Expose a storage item as a signal that stays live.
 *
 * The `watch` subscription is what makes surfaces agree with each other: change
 * a setting in the popup and the options page follows without a reload, because
 * both read one key instead of each holding a copy.
 *
 * Emits `null` until the first async read resolves — check for it before use.
 * Call it from an injection context (a field initializer is one); it takes
 * `DestroyRef` to drop the watcher when its owner is destroyed.
 */
export function storageSignal<T>(item: StorageItemLike<T>): Signal<T | null> {
  const value = signal<T | null>(null);

  void item.getValue().then((initial) => value.set(initial));
  const unwatch = item.watch((next) => value.set(next));
  inject(DestroyRef).onDestroy(unwatch);

  return value.asReadonly();
}

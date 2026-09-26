"use client";

import { useSyncExternalStore } from "react";
import { getLocal, setLocal } from "./local-store";

/** Local flags for discovered easter eggs (feed secret achievements). */
export type EggFlags = Record<string, boolean>;

const EVENT = "clack:egg";
const EMPTY: EggFlags = {};
let cache: EggFlags | null = null;

function read(): EggFlags {
  if (cache) return cache;
  cache = getLocal<EggFlags>("eggs", {});
  return cache;
}

export function setEgg(name: string) {
  const cur = read();
  if (cur[name]) return;
  cache = { ...cur, [name]: true };
  setLocal("eggs", cache);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
}

export function useEggs(): EggFlags {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => EMPTY,
  );
}

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import type {
  ActivityState,
  CompanionColors,
  StateChangePayload,
  WalkingUpdatePayload,
  DialoguePayload,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Keep a ref that always holds the latest version of a callback. */
function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => { ref.current = value; });
  return ref;
}

/** Generic Tauri event subscription hook. Cleans up listener on unmount. */
function useTauriEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
  deps: unknown[],
): void {
  const handlerRef = useLatestRef(handler);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    listen<T>(eventName, (event) => {
      handlerRef.current(event.payload);
    })
      .then((unlisten) => { cleanup = unlisten; })
      .catch(console.error);

    return () => { cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventName, ...deps]);
}

// ─── Public hooks ─────────────────────────────────────────────────────────────

/**
 * Subscribe to Tauri `state-change` events for a specific companion.
 * The callback receives the new ActivityState.
 */
export function useStateChange(
  companionId: string,
  cb: (state: ActivityState) => void,
): void {
  const cbRef = useLatestRef(cb);
  useTauriEvent<StateChangePayload>(
    'state-change',
    (payload) => {
      if (payload.companion_id === companionId) {
        cbRef.current(payload.state);
      }
    },
    [companionId],
  );
}

/**
 * Subscribe to Tauri `walking-update` events for a specific companion.
 */
export function useWalkingUpdate(
  companionId: string,
  cb: (data: WalkingUpdatePayload) => void,
): void {
  const cbRef = useLatestRef(cb);
  useTauriEvent<WalkingUpdatePayload & { companion_id: string }>(
    'walking-update',
    (payload) => {
      if (payload.companion_id === companionId) {
        cbRef.current({ walking: payload.walking, direction: payload.direction });
      }
    },
    [companionId],
  );
}

/**
 * Subscribe to Tauri `dialogue` events.
 * The callback receives the dialogue text string.
 */
export function useDialogue(cb: (text: string) => void): void {
  const cbRef = useLatestRef(cb);
  useTauriEvent<DialoguePayload>(
    'dialogue',
    (payload) => { cbRef.current(payload.text); },
    [],
  );
}

/**
 * Subscribe to Tauri `buddy-nearby` events.
 * Triggers the greeting animation.
 */
export function useBuddyNearby(cb: () => void): void {
  const cbRef = useLatestRef(cb);
  useTauriEvent<null>(
    'buddy-nearby',
    () => { cbRef.current(); },
    [],
  );
}

/**
 * Subscribe to Tauri `companion-config` events.
 * Delivers the companion name and colour palette.
 */
export function useCompanionConfig(
  cb: (config: { name: string; colors: CompanionColors }) => void,
): void {
  const cbRef = useLatestRef(cb);
  useTauriEvent<{ name: string; colors: CompanionColors }>(
    'companion-config',
    (payload) => { cbRef.current(payload); },
    [],
  );
}

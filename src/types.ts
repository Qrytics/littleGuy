export type ActivityState =
  | 'idle'
  | 'active'
  | 'typing'
  | 'coding'
  | 'sleeping'
  | 'walking'
  | 'greeting';

export interface Companion {
  id: string;
  name: string;
  companion_type: string;
  x: number | null;
  y: number | null;
}

export interface CompanionColors {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  shoes: string;
}

export interface RecapEntry {
  process_name: string;
  window_title: string;
  state: string;
  total_ms: number;
}

export interface RecapData {
  date: string;
  total_ms: number;
  by_app: RecapEntry[];
  by_category: Record<string, number>;
}

export interface Settings {
  walking_enabled: boolean;
  dialogue_enabled: boolean;
  total_pets: number;
}

export interface StateChangePayload {
  state: ActivityState;
  companion_id: string;
}

export interface WalkingUpdatePayload {
  walking: boolean;
  direction: number;
}

export interface DialoguePayload {
  text: string;
}

// Nightshade: The Quiet Heist — tuning constants in one place.
// One tile is 32 px; the playfield is 40 x 21 tiles under a 48 px HUD bar,
// so the logical view is 1280 x 720 and the whole level fits on screen.

export const TILE = 32;
export const COLS = 40;
export const ROWS = 21;
export const HUD_H = 48;
export const VIEW_W = 1280;
export const VIEW_H = 720;

export const STEP = 1 / 60;

// Player speeds in tiles per second.
export const PLAYER_WALK = 3.4;
export const PLAYER_SNEAK = 2.0;
export const PLAYER_RUN = 4.6;

// Guard speeds in tiles per second.
export const GUARD_PATROL = 1.7;
export const GUARD_ALERT = 2.9;
export const GUARD_CHASE = 3.6;

// Vision: cone half-angle in radians and range in tiles.
export const CONE_HALF = 0.62;
export const CONE_RANGE = 6.5;
export const CONE_RANGE_ALARM = 8.0;

// Detection meter: 0 is unseen, 1 is caught in the act (alarm).
// Fill is per second of full exposure at point-blank range, scaled by
// distance, the player's stance and the light where they stand.
export const DETECT_FILL = 1.15;
export const DETECT_DRAIN = 0.4;
export const SUSPICIOUS_AT = 0.35;
export const ALARM_AT = 1.0;

// How long a guard keeps chasing after losing sight before it gives up
// and searches the last place it saw you.
export const CHASE_MEMORY = 3.0;
export const SEARCH_TIME = 4.0;
export const WAYPOINT_PAUSE = 1.4;

// Noise: a footstep is heard by a guard within this many tiles.
export const NOISE_SNEAK = 1.2;
export const NOISE_WALK = 2.6;
export const NOISE_RUN = 4.8;
export const NOISE_COIN = 5.5;

// Gadgets.
export const COIN_RANGE = 4.0;
export const SMOKE_RADIUS = 1.9;
export const SMOKE_TIME = 4.0;

// Scoring.
export const SCORE_TREASURE = 100;
export const SCORE_GEM = 300;
export const SCORE_GHOST = 500;
export const SCORE_TIME_PER_SEC = 5;

// localStorage keys.
export const SAVE_KEY = 'nightshade-save-v1';

// Screens the renderer can paint.
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL_DONE = 'level-done';
export const SCREEN_GAME_DONE = 'game-done';

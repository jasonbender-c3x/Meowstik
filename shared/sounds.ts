/**
 * Soundboard — shared sound definitions
 * Used by server (tool declarations) and client (synthesis/playback)
 */

export interface SoundDef {
  id: string;
  name: string;
  pack: SoundPack;
  description: string; // LLM-facing description
  emoji: string;
}

export type SoundPack = "comedy" | "alarms" | "notifications" | "radio" | "nature";

export const SOUNDS: Record<string, SoundDef> = {
  // ── Comedy / Morning Zoo ─────────────────────────────────────────────────
  womp_womp:      { id: "womp_womp",      pack: "comedy",        emoji: "📯", name: "Womp Womp",      description: "Sad trombone descending tone for failures, bad news, or jokes that land wrong" },
  rimshot:        { id: "rimshot",        pack: "comedy",        emoji: "🥁", name: "Rimshot",        description: "Ba-dum-tss! Drum hit for punchlines and jokes" },
  airhorn:        { id: "airhorn",        pack: "comedy",        emoji: "📢", name: "Air Horn",       description: "Loud air horn blast for hype, wins, or interruptions" },
  fart:           { id: "fart",           pack: "comedy",        emoji: "💨", name: "Fart",           description: "Classic fart sound effect for comedy, awkward moments, or bad ideas" },
  fart_long:      { id: "fart_long",      pack: "comedy",        emoji: "💨", name: "Long Fart",      description: "Extended fart for extra emphasis on truly terrible ideas" },
  crickets:       { id: "crickets",       pack: "comedy",        emoji: "🦗", name: "Crickets",       description: "Awkward silence crickets for when nobody responds" },
  price_is_wrong: { id: "price_is_wrong", pack: "comedy",        emoji: "😬", name: "Wrong Answer",   description: "Descending game-show fail sound" },
  laugh_track:    { id: "laugh_track",    pack: "comedy",        emoji: "😂", name: "Laugh Track",    description: "Studio audience laughter for comedy moments" },

  // ── Radio ────────────────────────────────────────────────────────────────
  jingle:         { id: "jingle",         pack: "radio",         emoji: "🎵", name: "Jingle",         description: "Short upbeat radio station jingle" },
  news_intro:     { id: "news_intro",     pack: "radio",         emoji: "📰", name: "News Intro",     description: "Breaking news dramatic sting" },
  traffic_alert:  { id: "traffic_alert",  pack: "radio",         emoji: "🚗", name: "Traffic Alert",  description: "Traffic report alert beep" },
  weather_beep:   { id: "weather_beep",   pack: "radio",         emoji: "🌤",  name: "Weather Beep",   description: "Weather segment transition beep" },

  // ── Alarms ───────────────────────────────────────────────────────────────
  alarm_clock:    { id: "alarm_clock",    pack: "alarms",        emoji: "⏰", name: "Alarm Clock",    description: "Classic beeping alarm clock for wake-up or reminders" },
  gentle_wake:    { id: "gentle_wake",    pack: "alarms",        emoji: "🌅", name: "Gentle Wake",    description: "Soft rising chime to wake gently" },
  pill_reminder:  { id: "pill_reminder",  pack: "alarms",        emoji: "💊", name: "Pill Reminder",  description: "Friendly double-chime medication reminder" },
  urgent_alarm:   { id: "urgent_alarm",   pack: "alarms",        emoji: "🚨", name: "Urgent Alarm",   description: "Urgent rapid beeping for critical alerts" },

  // ── Notifications ────────────────────────────────────────────────────────
  ding:           { id: "ding",           pack: "notifications", emoji: "🔔", name: "Ding",           description: "Simple pleasant notification chime" },
  success:        { id: "success",        pack: "notifications", emoji: "🎉", name: "Success",        description: "Ascending victory fanfare for completed tasks or wins" },
  error_buzz:     { id: "error_buzz",     pack: "notifications", emoji: "❌", name: "Error Buzz",     description: "Error buzzer for failures or invalid input" },
  level_up:       { id: "level_up",       pack: "notifications", emoji: "⬆️", name: "Level Up",       description: "Achievement unlocked ascending arpeggio" },
  incoming:       { id: "incoming",       pack: "notifications", emoji: "📨", name: "Incoming",       description: "New message or incoming call tones" },
};

export const SOUND_IDS = Object.keys(SOUNDS) as (keyof typeof SOUNDS)[];

export const SOUND_PACKS: Record<SoundPack, { name: string; emoji: string; description: string }> = {
  comedy:        { emoji: "🎭", name: "Comedy / Zoo",    description: "Morning zoo radio effects" },
  radio:         { emoji: "📻", name: "Radio",           description: "Broadcast and news stings" },
  alarms:        { emoji: "⏰", name: "Alarms",          description: "Wake-up and reminder sounds" },
  notifications: { emoji: "🔔", name: "Notifications",   description: "Alerts and feedback tones" },
  nature:        { emoji: "🌿", name: "Nature",          description: "Ambient nature sounds" },
};

export function getSoundsByPack(pack: SoundPack): SoundDef[] {
  return Object.values(SOUNDS).filter(s => s.pack === pack);
}

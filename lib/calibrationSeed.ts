// SINGLE SOURCE of the VR calibration data — consumed by BOTH:
//   - the tour local preview (lib/localPreviewData.ts), and
//   - the WYSIWYG editor (components/dev/CalibrationTool.tsx), as its default
//     data so a fresh visit never shows an empty room.
//
// Exported from /dev/calibrate (version 2). yaw/pitch are WORLD-space and used
// DIRECTLY as hotspot.yaw/pitch (no -90 correction). `arrow_deg` is the free
// arrow rotation for navigation. Restricted rooms (18–26) are now mapped too.
//
// Two info hotspots for Ruang 3 are INJECTED here (marked below) — they existed
// in the old tour and are carried over; the editor export does not include them
// yet, so they are re-added here on each update. Their yaw/pitch are world-space.
//
// This is preview/seed data. The backend team owns the real seeded data; see
// docs/HANDOFF-BACKEND-VR-DATA.md.

import type { Hotspot } from '@/lib/types/tour';

export type SeedRoom = { initial_yaw: number; roll: number; hotspots: Hotspot[] };

export const calibrationSeed: { version: number; rooms: Record<string, SeedRoom> } = {
  version: 2,
  rooms: {
    '1': {
      initial_yaw: -37,
      roll: 1.5,
      hotspots: [
        { id: '1-hs-msk8u6i1', type: 'navigation', yaw: -6, pitch: -31, label: 'Hotspot 1', target_scene_id: '2', arrow_deg: 0 },
        { id: '1-hs-msk8uenx', type: 'navigation', yaw: 130, pitch: -11, label: 'Hotspot 2', target_scene_id: 'lobby', variant: 'door' },
      ],
    },
    '2': {
      initial_yaw: -25,
      roll: 1,
      hotspots: [
        { id: '2-hs-msk8uqrt', type: 'navigation', yaw: 111, pitch: -32, label: 'Hotspot 1', target_scene_id: '1', arrow_deg: 0 },
        { id: '2-hs-msk8utoj', type: 'navigation', yaw: -117, pitch: -36, label: 'Hotspot 2', target_scene_id: '3', arrow_deg: 0 },
      ],
    },
    '3': {
      initial_yaw: -83,
      roll: 0.5,
      hotspots: [
        { id: '3-hs-msk83pwx', type: 'navigation', yaw: -114, pitch: -28, label: 'Hotspot 1', target_scene_id: '10', arrow_deg: 0 },
        { id: '3-hs-msk8valq', type: 'navigation', yaw: 146, pitch: -38, label: 'Hotspot 2', target_scene_id: '2', arrow_deg: 0 },
        { id: '3-hs-msk8vhvn', type: 'navigation', yaw: -145, pitch: -30, label: 'Hotspot 3', target_scene_id: '4', arrow_deg: 0 },
        // ── INJECTED: info hotspots carried over from the old tour ──
        { id: '3-info-1', type: 'info', yaw: -32, pitch: 5, label: 'Koleksi 1 (placeholder)', collection_id: 'placeholder-3-info-1' },
        { id: '3-info-2', type: 'info', yaw: -5, pitch: -20, label: 'Koleksi 2 (placeholder)', collection_id: 'placeholder-3-info-2' },
      ],
    },
    '4': {
      initial_yaw: -93,
      roll: 3,
      hotspots: [
        { id: '4-hs-msk8x56s', type: 'navigation', yaw: 146, pitch: -37, label: 'Hotspot 1', target_scene_id: '7', arrow_deg: 0 },
        { id: '4-hs-msk8x84n', type: 'navigation', yaw: -138, pitch: -25, label: 'Hotspot 2', target_scene_id: '3', arrow_deg: 0 },
      ],
    },
    '5': { initial_yaw: -75, roll: 3, hotspots: [] },
    '6': { initial_yaw: -117, roll: 3, hotspots: [] },
    '7': {
      initial_yaw: -93,
      roll: 3,
      hotspots: [
        { id: '7-hs-msk84g0p', type: 'navigation', yaw: 161, pitch: -24, label: 'Hotspot 1', target_scene_id: '3', arrow_deg: 0 },
        { id: '7-hs-msk8565i', type: 'navigation', yaw: -125, pitch: -35, label: 'Hotspot 2', target_scene_id: '4', arrow_deg: 0 },
        { id: '7-hs-msk85qu0', type: 'navigation', yaw: 95, pitch: -33, label: 'Hotspot 3', target_scene_id: '8', arrow_deg: 0 },
      ],
    },
    '8': {
      initial_yaw: -94,
      roll: 3,
      hotspots: [
        { id: '8-hs-msk86yi7', type: 'navigation', yaw: 96, pitch: -22, label: 'Hotspot 1', target_scene_id: '11', arrow_deg: 0 },
        { id: '8-hs-msk870na', type: 'navigation', yaw: 117, pitch: -30, label: 'Hotspot 2', target_scene_id: '9', arrow_deg: 26 },
        { id: '8-hs-msk8yjez', type: 'navigation', yaw: -88, pitch: -34, label: 'Hotspot 3', target_scene_id: '7', arrow_deg: 0 },
        { id: '8-hs-msk8yn72', type: 'navigation', yaw: 180, pitch: -25, label: 'Hotspot 4', target_scene_id: '3', arrow_deg: 0 },
        { id: '8-hs-msk8ypqu', type: 'navigation', yaw: -118, pitch: -27, label: 'Hotspot 5', target_scene_id: '4', arrow_deg: 0 },
      ],
    },
    '9': {
      initial_yaw: -88,
      roll: 3.5,
      hotspots: [
        { id: '9-hs-msk88fm8', type: 'navigation', yaw: 147, pitch: -30, label: 'Hotspot 1', target_scene_id: '11', arrow_deg: 0 },
        { id: '9-hs-msk88jhp', type: 'navigation', yaw: -154, pitch: -30, label: 'Hotspot 2', target_scene_id: '13', arrow_deg: 328 },
        { id: '9-hs-msk88ld9', type: 'navigation', yaw: -131, pitch: -21, label: 'Hotspot 3', target_scene_id: '14', arrow_deg: 0 },
        { id: '9-hs-msk88qid', type: 'navigation', yaw: -87, pitch: -29, label: 'Hotspot 4', target_scene_id: '10', arrow_deg: 0 },
        { id: '9-hs-msk8zgok', type: 'navigation', yaw: 65, pitch: -35, label: 'Hotspot 5', target_scene_id: '8', arrow_deg: 0 },
      ],
    },
    '10': {
      initial_yaw: -94,
      roll: 3.5,
      hotspots: [
        { id: '10-hs-msk8a52z', type: 'navigation', yaw: 90, pitch: -30, label: 'Hotspot 1', target_scene_id: '9', arrow_deg: 0 },
        { id: '10-hs-msk8adww', type: 'navigation', yaw: 173, pitch: -32, label: 'Hotspot 2', target_scene_id: '13', arrow_deg: 0 },
        { id: '10-hs-msk8ai1f', type: 'navigation', yaw: -77, pitch: -31, label: 'Hotspot 3', target_scene_id: '3', arrow_deg: 15 },
        { id: '10-hs-msk8b6xb', type: 'navigation', yaw: 145, pitch: -29, label: 'Hotspot 4', target_scene_id: '12', arrow_deg: 0 },
        { id: '10-hs-msk8ba8y', type: 'navigation', yaw: 114, pitch: -26, label: 'Hotspot 5', target_scene_id: '11', arrow_deg: 0 },
        { id: '10-hs-msk8boyu', type: 'navigation', yaw: -141, pitch: -31, label: 'Hotspot 6', target_scene_id: '14', arrow_deg: 332 },
      ],
    },
    '11': {
      initial_yaw: -85,
      roll: 3,
      hotspots: [
        { id: '11-hs-msk8jc8s', type: 'navigation', yaw: -75, pitch: -28, label: 'Hotspot 1', target_scene_id: '8', arrow_deg: 0 },
        { id: '11-hs-msk8jexl', type: 'navigation', yaw: -116, pitch: -29, label: 'Hotspot 2', target_scene_id: '9', arrow_deg: 0 },
        { id: '11-hs-msk8jlf1', type: 'navigation', yaw: 96, pitch: -49, label: 'Hotspot 3', target_scene_id: '12', arrow_deg: 0 },
        { id: '11-hs-msk8jp0l', type: 'navigation', yaw: 163, pitch: -26, label: 'Hotspot 4', target_scene_id: '13', arrow_deg: 0 },
      ],
    },
    '12': {
      initial_yaw: -88,
      roll: 3,
      hotspots: [
        { id: '12-hs-msk8kul9', type: 'navigation', yaw: 88, pitch: -28, label: 'Hotspot 1', target_scene_id: '13', arrow_deg: 0 },
        { id: '12-hs-msk8kxwd', type: 'navigation', yaw: -166, pitch: -44, label: 'Hotspot 2', target_scene_id: '11', arrow_deg: 0 },
      ],
    },
    '13': {
      initial_yaw: -97,
      roll: 3.5,
      hotspots: [
        { id: '13-hs-msk8lk4y', type: 'navigation', yaw: 167, pitch: -32, label: 'Hotspot 1', target_scene_id: '10', arrow_deg: 0 },
        { id: '13-hs-msk8llul', type: 'navigation', yaw: -155, pitch: -31, label: 'Hotspot 2', target_scene_id: '9', arrow_deg: 0 },
        { id: '13-hs-msk8lot3', type: 'navigation', yaw: -89, pitch: -27, label: 'Hotspot 3', target_scene_id: '12', arrow_deg: 0 },
        { id: '13-hs-msk8lszt', type: 'navigation', yaw: 95, pitch: -28, label: 'Hotspot 4', target_scene_id: '14', arrow_deg: 0 },
      ],
    },
    '14': {
      initial_yaw: -95,
      roll: 4,
      hotspots: [
        { id: '14-hs-msk8nzff', type: 'navigation', yaw: 92, pitch: -33, label: 'Hotspot 1', target_scene_id: '15', arrow_deg: 0 },
        { id: '14-hs-msk8o4hb', type: 'navigation', yaw: 162, pitch: -26, label: 'Hotspot 2', target_scene_id: '3', arrow_deg: 0 },
        { id: '14-hs-msk8oa89', type: 'navigation', yaw: -159, pitch: -27, label: 'Hotspot 3', target_scene_id: '10', arrow_deg: 0 },
        { id: '14-hs-msk8oe5o', type: 'navigation', yaw: -87, pitch: -30, label: 'Hotspot 4', target_scene_id: '13', arrow_deg: 0 },
      ],
    },
    '15': {
      initial_yaw: -92,
      roll: 1.5,
      hotspots: [
        { id: '15-hs-msk8px2u', type: 'navigation', yaw: -96, pitch: -31, label: 'Hotspot 1', target_scene_id: '17', arrow_deg: 0 },
        { id: '15-hs-msk8pzjw', type: 'navigation', yaw: 170, pitch: -30, label: 'Hotspot 2', target_scene_id: '14', arrow_deg: 0 },
        { id: '15-hs-msk8q3rb', type: 'navigation', yaw: 127, pitch: -23, label: 'Hotspot 3', target_scene_id: '10', arrow_deg: 0 },
        { id: '15-hs-msk8q5xt', type: 'navigation', yaw: 77, pitch: -28, label: 'Hotspot 4', target_scene_id: '16', arrow_deg: 0 },
      ],
    },
    '16': {
      initial_yaw: -96,
      roll: 1,
      hotspots: [
        { id: '16-hs-msk8ro11', type: 'navigation', yaw: 105, pitch: -36, label: 'Hotspot 1', target_scene_id: '15', arrow_deg: 0 },
      ],
    },
    '17': {
      initial_yaw: -93,
      roll: 1.5,
      hotspots: [
        { id: '17-hs-msk8sfeq', type: 'navigation', yaw: -122, pitch: -29, label: 'Hotspot 1', target_scene_id: '15', arrow_deg: 0 },
        { id: '17-hs-msk8sjy1', type: 'navigation', yaw: -72, pitch: -8, label: 'Hotspot 2', target_scene_id: 'restricted-18', variant: 'door' },
      ],
    },
    lobby: {
      // Arrival faces the museum entrance door (blue/yellow wall), centered.
      // initial_yaw 172 → -98 (+90° right), then fine-tuned to -90. The door
      // hotspot stays pinned at world yaw 0 (front).
      initial_yaw: -90,
      roll: 1.5,
      hotspots: [
        { id: 'lobby-hs-msk8thkh', type: 'navigation', yaw: 0, pitch: -1, label: 'Hotspot 1', target_scene_id: '1', variant: 'door' },
      ],
    },
    'lobby-open': { initial_yaw: 0, roll: 0, hotspots: [] },
    'restricted-18': {
      initial_yaw: -91,
      roll: 0,
      hotspots: [
        { id: 'restricted-18-hs-mskabner', type: 'navigation', yaw: 41, pitch: -36, label: 'Hotspot 1', target_scene_id: 'restricted-19', arrow_deg: 0 },
        { id: 'restricted-18-hs-mskabqby', type: 'navigation', yaw: -45, pitch: -30, label: 'Hotspot 2', target_scene_id: 'restricted-24', arrow_deg: 0 },
        { id: 'restricted-18-hs-mskahyki', type: 'navigation', yaw: 136, pitch: -4, label: 'Hotspot 3', target_scene_id: '17', variant: 'door' },
      ],
    },
    'restricted-19': {
      initial_yaw: -90, // rotated 90° left (was 0); hotspots +90 to stay glued
      roll: 0,
      hotspots: [
        { id: 'restricted-19-hs-mskacgxk', type: 'navigation', yaw: 78, pitch: -40, label: 'Hotspot 1', target_scene_id: 'restricted-18', arrow_deg: 0 },
        { id: 'restricted-19-hs-mskacirl', type: 'navigation', yaw: 125, pitch: -39, label: 'Hotspot 2', target_scene_id: 'restricted-24', arrow_deg: 0 },
        { id: 'restricted-19-hs-mskackvm', type: 'navigation', yaw: -164, pitch: -45, label: 'Hotspot 3', target_scene_id: 'restricted-25', arrow_deg: 0 },
        { id: 'restricted-19-hs-mskacnne', type: 'navigation', yaw: -86, pitch: -35, label: 'Hotspot 4', target_scene_id: 'restricted-21', arrow_deg: 0 },
      ],
    },
    'restricted-20': {
      initial_yaw: -90, // rotated 90° left (was 0); hotspots +90 to stay glued
      roll: 0,
      hotspots: [
        { id: 'restricted-20-hs-mskadrqx', type: 'navigation', yaw: 91, pitch: -35, label: 'Hotspot 1', target_scene_id: 'restricted-21', arrow_deg: 0 },
        { id: 'restricted-20-hs-mskaljp0', type: 'navigation', yaw: -96, pitch: -33, label: 'Hotspot 2', target_scene_id: 'restricted-22', arrow_deg: 0 },
      ],
    },
    'restricted-21': {
      initial_yaw: -89, // rotated 90° left (was 1); hotspots +90 to stay glued
      roll: 0,
      hotspots: [
        { id: 'restricted-21-hs-mskadeko', type: 'navigation', yaw: -146, pitch: -37, label: 'Hotspot 1', target_scene_id: 'restricted-20', arrow_deg: 0 },
        { id: 'restricted-21-hs-mskadg6v', type: 'navigation', yaw: 151, pitch: -46, label: 'Hotspot 2', target_scene_id: 'restricted-26', arrow_deg: 0 },
        { id: 'restricted-21-hs-mskadhro', type: 'navigation', yaw: 88, pitch: -35, label: 'Hotspot 3', target_scene_id: 'restricted-19', arrow_deg: 0 },
      ],
    },
    'restricted-22': {
      initial_yaw: -91, // rotated 90° left (was -1); hotspots +90 to stay glued
      roll: 0,
      hotspots: [
        { id: 'restricted-22-hs-mskaebgt', type: 'navigation', yaw: 56, pitch: -28, label: 'Hotspot 1', target_scene_id: 'restricted-23', arrow_deg: 0 },
        { id: 'restricted-22-hs-mskaedrm', type: 'navigation', yaw: -55, pitch: -38, label: 'Hotspot 2', target_scene_id: 'restricted-20', arrow_deg: 0 },
        { id: 'restricted-22-hs-mskaefxh', type: 'navigation', yaw: 2, pitch: -45, label: 'Hotspot 3', target_scene_id: 'restricted-26', arrow_deg: 0 },
      ],
    },
    'restricted-23': {
      initial_yaw: -92, // rotated 90° left (was -2); hotspots +90 to stay glued
      roll: 0,
      hotspots: [
        { id: 'restricted-23-hs-mskaeuju', type: 'navigation', yaw: 140, pitch: -45, label: 'Hotspot 1', target_scene_id: 'restricted-25', arrow_deg: 0 },
        { id: 'restricted-23-hs-mskaewou', type: 'navigation', yaw: -126, pitch: -40, label: 'Hotspot 2', target_scene_id: 'restricted-24', arrow_deg: 0 },
        { id: 'restricted-23-hs-mskaezp6', type: 'navigation', yaw: 94, pitch: -30, label: 'Hotspot 3', target_scene_id: 'restricted-22', arrow_deg: 0 },
      ],
    },
    'restricted-24': {
      initial_yaw: -94, // rotated 90° left (was -4); hotspots +90 to stay glued
      roll: 0,
      hotspots: [
        { id: 'restricted-24-hs-mskafd8e', type: 'navigation', yaw: 146, pitch: -42, label: 'Hotspot 1', target_scene_id: 'restricted-23', arrow_deg: 0 },
        { id: 'restricted-24-hs-mskafkby', type: 'navigation', yaw: -86, pitch: -28, label: 'Hotspot 2', target_scene_id: 'restricted-18', arrow_deg: 0 },
      ],
    },
    'restricted-25': {
      initial_yaw: -91, // rotated 90° left (was -1); hotspots +90 to stay glued
      roll: -2.5,
      hotspots: [
        { id: 'restricted-25-hs-mskafxcu', type: 'navigation', yaw: 98, pitch: -36, label: 'Hotspot 1', target_scene_id: 'restricted-23', arrow_deg: 0 },
        { id: 'restricted-25-hs-mskafzpk', type: 'navigation', yaw: -85, pitch: -33, label: 'Hotspot 2', target_scene_id: 'restricted-19', arrow_deg: 0 },
      ],
    },
    'restricted-26': {
      initial_yaw: -90, // rotated 90° left (was 0); hotspots +90 to stay glued
      roll: -1.5,
      hotspots: [
        { id: 'restricted-26-hs-mskag7yr', type: 'navigation', yaw: -90, pitch: -31, label: 'Hotspot 1', target_scene_id: 'restricted-21', arrow_deg: 0 },
        { id: 'restricted-26-hs-mskaga0o', type: 'navigation', yaw: 102, pitch: -31, label: 'Hotspot 2', target_scene_id: 'restricted-22', arrow_deg: 0 },
      ],
    },
  },
};

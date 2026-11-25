import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";

import { C } from "@/components/run-ui";

/**
 * A dark city map seen from above, with a GPS route drawing itself in lime.
 * On the web it runs live on a canvas; elsewhere it is drawn once.
 * `boost` makes the runner sprint to the end of the route (used while signing in).
 */

const GRID = 40;
const NIGHT = "#222527";
const BLOCK = "#262A2C";
const STREET = "#2C3032";
const AVENUE = "#34383B";

type Route = { pts: [number, number][]; lengths: number[]; total: number };

function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeRoute(origin: [number, number], rnd: () => number): Route {
  const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const pts: [number, number][] = [origin];
  let dir = 0;
  let [x, y] = origin;
  for (let i = 0; i < 26; i++) {
    const r = rnd();
    dir = r < 0.45 ? dir : r < 0.72 ? (dir + 1) % 4 : (dir + 3) % 4;
    const n = 1 + Math.floor(rnd() * 3);
    x += dirs[dir][0] * n * GRID;
    y += dirs[dir][1] * n * GRID;
    pts.push([x, y]);
  }
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, lengths, total: lengths[lengths.length - 1] };
}

function pointAt(route: Route, d: number): [number, number, number] {
  const { pts, lengths } = route;
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < d) i++;
  const t = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, i];
}

/** 1 km of the hero's make-believe run is 200 map units, at a 5:12 pace. */
export function heroKm(distance: number) {
  return distance / 200;
}

export function RouteMapHero({ boost = false, focus = { x: 0.56, y: 0.42 }, onDistance }: { boost?: boolean; focus?: { x: number; y: number }; onDistance?: (units: number) => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((old) => (Math.round(old.width) === Math.round(width) && Math.round(old.height) === Math.round(height) ? old : { width, height }));
  };
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {size.width > 0 ? (Platform.OS === "web"
        ? <LiveMap width={size.width} height={size.height} boost={boost} focus={focus} onDistance={onDistance} />
        : <StillMap width={size.width} height={size.height} />) : null}
    </View>
  );
}

function LiveMap({ width, height, boost, focus, onDistance }: { width: number; height: number; boost: boolean; focus: { x: number; y: number }; onDistance?: (units: number) => void }) {
  const node = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(0);
  const attach = useCallback((canvas: HTMLCanvasElement | null) => {
    node.current = canvas;
    if (canvas) setMounted((count) => count + 1);
  }, []);
  const reduced = useReducedMotion();
  const boostRef = useRef(boost);
  const report = useRef(onDistance);
  useEffect(() => {
    boostRef.current = boost;
    report.current = onDistance;
  }, [boost, onDistance]);

  useEffect(() => {
    const el = node.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    el.width = Math.round(width * ratio);
    el.height = Math.round(height * ratio);
    const rnd = makeRandom(7);
    let route = makeRoute([0, 0], rnd);
    let d = 0;
    let done = 0;
    let speed = 24;
    let camX = 0;
    let camY = 0;
    let last = performance.now();
    let sinceReport = 0;
    let frame = 0;
    const reach = Math.max(width, height) * 1.4;

    const draw = (px: number, py: number, index: number) => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = NIGHT;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width * focus.x, height * focus.y);
      ctx.rotate(-0.32);
      ctx.translate(-camX, -camY);
      const x0 = Math.floor((camX - reach) / GRID) * GRID;
      const y0 = Math.floor((camY - reach) / GRID) * GRID;
      const span = reach * 2;
      ctx.fillStyle = BLOCK;
      for (let gx = x0; gx < x0 + span; gx += GRID) {
        for (let gy = y0; gy < y0 + span; gy += GRID) {
          if ((((gx * 13 + gy * 7) / GRID) & 7) === 0) ctx.fillRect(gx + 6, gy + 6, GRID - 12, GRID - 12);
        }
      }
      for (let k = 0; k < 2; k++) {
        const start = k ? y0 : x0;
        for (let v = start; v < start + span; v += GRID) {
          const avenue = ((v / GRID) % 4 + 4) % 4 === 0;
          ctx.strokeStyle = avenue ? AVENUE : STREET;
          ctx.lineWidth = avenue ? 3.5 : 1.3;
          ctx.beginPath();
          if (k) { ctx.moveTo(x0, v); ctx.lineTo(x0 + span, v); } else { ctx.moveTo(v, y0); ctx.lineTo(v, y0 + span); }
          ctx.stroke();
        }
      }
      const { pts } = route;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(244,244,239,0.14)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = C.lime;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < index; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = C.cone;
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], 5, 0, Math.PI * 2);
      ctx.fill();
      const pulse = (performance.now() / 900) % 1;
      ctx.strokeStyle = `rgba(215,247,82,${0.45 * (1 - pulse)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 6 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = NIGHT;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = C.lime;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Keeps the route from running over the title and the numbers.
      const top = ctx.createLinearGradient(0, 0, 0, height * 0.34);
      top.addColorStop(0, "rgba(34,37,39,0.94)");
      top.addColorStop(1, "rgba(34,37,39,0)");
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, width, height * 0.34);
      const bottom = ctx.createLinearGradient(0, height * 0.72, 0, height);
      bottom.addColorStop(0, "rgba(34,37,39,0)");
      bottom.addColorStop(1, "rgba(34,37,39,0.9)");
      ctx.fillStyle = bottom;
      ctx.fillRect(0, height * 0.72, width, height * 0.28);
    };

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const target = boostRef.current ? (reduced ? 60 : 280) : 24;
      speed += (target - speed) * Math.min(dt * 2, 1);
      d += speed * dt * (reduced ? 0.3 : 1);
      if (d >= route.total) {
        done += route.total;
        const end = route.pts[route.pts.length - 1];
        route = makeRoute(end, makeRandom(Math.floor(Math.random() * 9999)));
        d = 0;
      }
      const [px, py, index] = pointAt(route, d);
      camX += (px - camX) * Math.min(dt * 1.5, 1);
      camY += (py - camY) * Math.min(dt * 1.5, 1);
      draw(px, py, index);
      sinceReport += dt;
      if (sinceReport > 0.15) {
        sinceReport = 0;
        report.current?.(done + d);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [mounted, width, height, reduced, focus.x, focus.y]);

  // The callback only stores the node; nothing reads the ref while rendering.
  // eslint-disable-next-line react-hooks/refs
  return createElement("canvas", { ref: attach, style: { width, height, display: "block" }, "aria-hidden": true });
}

/** Native fallback: the same streets and a finished route, drawn once. */
function StillMap({ width, height }: { width: number; height: number }) {
  const route = makeRoute([0, 0], makeRandom(7));
  const cx = width * 0.56;
  const cy = height * 0.42;
  const [ex, ey] = route.pts[route.pts.length - 1];
  const shiftX = -ex / 2;
  const shiftY = -ey / 2;
  const lines: string[] = [];
  const avenues: string[] = [];
  const reach = Math.max(width, height) * 1.4;
  for (let v = -reach - (reach % GRID); v < reach; v += GRID) {
    const target = (Math.round(v / GRID) % 4 === 0 ? avenues : lines);
    target.push(`M${v} ${-reach}L${v} ${reach}M${-reach} ${v}L${reach} ${v}`);
  }
  const d = route.pts.map(([x, y], i) => `${i ? "L" : "M"}${x + shiftX} ${y + shiftY}`).join("");
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={NIGHT} />
      <Path d={lines.join("")} stroke={STREET} strokeWidth={1.3} transform={`translate(${cx} ${cy}) rotate(-18)`} />
      <Path d={avenues.join("")} stroke={AVENUE} strokeWidth={3.5} transform={`translate(${cx} ${cy}) rotate(-18)`} />
      <Path d={d} stroke={C.lime} strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" transform={`translate(${cx} ${cy}) rotate(-18)`} />
    </Svg>
  );
}

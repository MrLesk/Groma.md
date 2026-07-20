import { useEffect, useRef, type ReactNode } from "react";

/**
 * Disposable canvas view state: translate and scale live only in memory and reset to a
 * deterministic fit on every load. Nothing here is ever persisted or sent anywhere.
 */
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const PAN_STEP = 64;

export interface CanvasProps {
  readonly children: ReactNode;
  /** Bump to refit the sheet (used after the first bounded page arrives). */
  readonly fitKey: number;
  /** Width of overlay chrome on the right that fitting should keep clear. */
  readonly reserveRight: number;
}

export function Canvas({ children, fitKey, reserveRight }: CanvasProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const reserveRef = useRef(reserveRight);
  reserveRef.current = reserveRight;

  useEffect(() => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    if (viewport === null || stage === null) return;
    const view = { s: 1, x: 0, y: 0 };
    /** Until the first deliberate interaction, layout changes keep re-fitting the sheet. */
    let interacted = false;
    const apply = () => {
      stage.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.s})`;
    };
    const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
    const fit = () => {
      const rect = viewport.getBoundingClientRect();
      const width = stage.offsetWidth;
      const height = stage.offsetHeight;
      if (width === 0 || height === 0 || rect.width < 64 || rect.height < 64) return;
      const reserve = rect.width - reserveRef.current - 48 > 240 ? reserveRef.current + 32 : 0;
      const availableWidth = rect.width - reserve - 48;
      const availableHeight = rect.height - 48;
      view.s = clamp(Math.min(availableWidth / width, availableHeight / height));
      view.x = Math.round((availableWidth - width * view.s) / 2 + 24);
      view.y = Math.max(24, Math.round((rect.height - height * view.s) / 2));
      apply();
    };
    const zoomAt = (pointX: number, pointY: number, factor: number) => {
      const next = clamp(view.s * factor);
      if (next === view.s) return;
      const ratio = next / view.s;
      view.x = pointX - (pointX - view.x) * ratio;
      view.y = pointY - (pointY - view.y) * ratio;
      view.s = next;
      apply();
    };
    const zoomCenter = (factor: number) => {
      const rect = viewport.getBoundingClientRect();
      zoomAt(rect.width / 2, rect.height / 2, factor);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      interacted = true;
      if (event.ctrlKey || event.metaKey) {
        zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.01));
      } else {
        view.x -= event.deltaX;
        view.y -= event.deltaY;
        apply();
      }
    };

    const points = new Map<number, readonly [number, number]>();
    let panPointer: number | null = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = false;
    let pinchDistance = 0;
    let suppressClick = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 1) return;
      points.set(event.pointerId, [event.clientX, event.clientY]);
      if (points.size === 1) {
        panPointer = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        originX = view.x;
        originY = view.y;
        moved = false;
      } else if (points.size === 2) {
        const [first, second] = [...points.values()];
        pinchDistance = Math.hypot(first![0] - second![0], first![1] - second![1]);
      }
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!points.has(event.pointerId)) return;
      points.set(event.pointerId, [event.clientX, event.clientY]);
      if (points.size === 2) {
        const [first, second] = [...points.values()];
        const distance = Math.hypot(first![0] - second![0], first![1] - second![1]);
        if (pinchDistance > 0 && distance > 0) {
          zoomAt(
            (first![0] + second![0]) / 2,
            (first![1] + second![1]) / 2,
            distance / pinchDistance,
          );
        }
        pinchDistance = distance;
        moved = true;
      } else if (event.pointerId === panPointer) {
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        if (!moved && Math.hypot(deltaX, deltaY) > 4) {
          moved = true;
          interacted = true;
          try {
            viewport.setPointerCapture(panPointer);
          } catch {
            /* capture is a hint, not a requirement */
          }
          viewport.classList.add("cursor-grabbing");
        }
        if (moved) {
          view.x = originX + deltaX;
          view.y = originY + deltaY;
          apply();
        }
      }
    };
    const onPointerLift = (event: PointerEvent) => {
      if (!points.delete(event.pointerId)) return;
      if (points.size < 2) pinchDistance = 0;
      if (event.pointerId === panPointer) {
        panPointer = null;
        if (moved) suppressClick = true;
        viewport.classList.remove("cursor-grabbing");
      }
    };
    const onClickCapture = (event: MouseEvent) => {
      if (suppressClick) {
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest("input,textarea,select,[contenteditable]") !== null ||
          target.closest("[data-canvas-keys='skip']") !== null)
      ) {
        return;
      }
      const key = event.key;
      if (key !== "0") interacted = true;
      if (key === "ArrowLeft") view.x += PAN_STEP;
      else if (key === "ArrowRight") view.x -= PAN_STEP;
      else if (key === "ArrowUp") view.y += PAN_STEP;
      else if (key === "ArrowDown") view.y -= PAN_STEP;
      else if (key === "+" || key === "=") {
        zoomCenter(1.25);
        event.preventDefault();
        return;
      } else if (key === "-" || key === "_") {
        zoomCenter(0.8);
        event.preventDefault();
        return;
      } else if (key === "0") {
        fit();
        event.preventDefault();
        return;
      } else return;
      apply();
      event.preventDefault();
    };
    const onFocusIn = (event: FocusEvent) => {
      const element = event.target;
      if (!(element instanceof Element) || !stage.contains(element)) return;
      const box = element.getBoundingClientRect();
      const rect = viewport.getBoundingClientRect();
      const margin = 24;
      let deltaX = 0;
      let deltaY = 0;
      if (box.left < rect.left + margin) deltaX = rect.left + margin - box.left;
      else if (box.right > rect.right - margin) deltaX = rect.right - margin - box.right;
      if (box.top < rect.top + margin) deltaY = rect.top + margin - box.top;
      else if (box.bottom > rect.bottom - margin) deltaY = rect.bottom - margin - box.bottom;
      if (deltaX !== 0 || deltaY !== 0) {
        view.x += deltaX;
        view.y += deltaY;
        apply();
      }
    };
    const onScroll = () => {
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    };
    const onControl = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "fit") fit();
      else if (action === "zoom-in") {
        interacted = true;
        zoomCenter(1.25);
      } else if (action === "zoom-out") {
        interacted = true;
        zoomCenter(0.8);
      }
    };
    const observer = new ResizeObserver(() => {
      if (!interacted) fit();
    });
    observer.observe(viewport);
    observer.observe(stage);

    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("pointerdown", onPointerDown);
    viewport.addEventListener("pointermove", onPointerMove);
    viewport.addEventListener("pointerup", onPointerLift);
    viewport.addEventListener("pointercancel", onPointerLift);
    viewport.addEventListener("click", onClickCapture, true);
    viewport.addEventListener("scroll", onScroll);
    viewport.addEventListener("groma-canvas-control", onControl);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    fit();
    return () => {
      observer.disconnect();
      viewport.removeEventListener("wheel", onWheel);
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerLift);
      viewport.removeEventListener("pointercancel", onPointerLift);
      viewport.removeEventListener("click", onClickCapture, true);
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("groma-canvas-control", onControl);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [fitKey]);

  const control = (action: "fit" | "zoom-in" | "zoom-out") => {
    viewportRef.current?.dispatchEvent(
      new CustomEvent<string>("groma-canvas-control", { detail: action }),
    );
  };

  return (
    <div
      ref={viewportRef}
      className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-desk select-none"
    >
      <div ref={stageRef} className="absolute top-0 left-0 w-[1480px] origin-top-left">
        {children}
      </div>
      <div className="absolute bottom-4 left-4 flex gap-1.5" data-canvas-keys="skip">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => control("zoom-out")}
          className="border border-ink bg-paper px-2.5 py-1.5 font-plan text-xs hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => control("zoom-in")}
          className="border border-ink bg-paper px-2.5 py-1.5 font-plan text-xs hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => control("fit")}
          className="border border-ink bg-paper px-2.5 py-1.5 font-plan text-xs hover:border-survey focus-visible:outline-2 focus-visible:outline-survey"
        >
          Fit
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useMotionValue, animate } from "framer-motion";

const ROUTES = ["/topics", "/tokens", "/portfolio"];
const SWIPE_THRESHOLD_RATIO = 0.35;
const DIRECTION_RATIO = 1.5;
const RUBBER_BAND = 0.15;
const MIN_DRAG_PX = 8;

// Deteksi apakah touch target ada di dalam elemen yang bisa scroll horizontal
function isInsideHorizontalScroll(el: Element | null): boolean {
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

export function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const x = useMotionValue(0);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  // Saat pathname berubah karena swipe, slide page baru masuk
  useEffect(() => {
    if (pathname !== prevPathnameRef.current && isNavigatingRef.current) {
      prevPathnameRef.current = pathname;
      isNavigatingRef.current = false;
      animate(x, 0, {
        type: "spring",
        stiffness: 350,
        damping: 35,
        mass: 0.8,
      });
    } else {
      prevPathnameRef.current = pathname;
    }
  }, [pathname, x]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (isNavigatingRef.current) return;
      if (pathname.startsWith("/tokens/") || pathname.startsWith("/topics/")) return;
      const idx = ROUTES.indexOf(pathname);
      if (idx === -1) return;
      if (isInsideHorizontalScroll(e.target as Element)) return;

      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      isDraggingRef.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!startRef.current || isNavigatingRef.current) return;

      const dx = e.touches[0].clientX - startRef.current.x;
      const dy = e.touches[0].clientY - startRef.current.y;

      if (!isDraggingRef.current) {
        if (Math.abs(dx) < MIN_DRAG_PX && Math.abs(dy) < MIN_DRAG_PX) return;
        // Batalkan jika dominan vertikal
        if (Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) {
          startRef.current = null;
          return;
        }
        isDraggingRef.current = true;
      }

      // Mencegah scroll vertikal selama swipe horizontal
      e.preventDefault();

      const idx = ROUTES.indexOf(pathname);
      const atStart = idx <= 0;
      const atEnd = idx >= ROUTES.length - 1;

      let boundedDx = dx;
      if ((dx < 0 && atEnd) || (dx > 0 && atStart)) {
        boundedDx = dx * RUBBER_BAND;
      }

      x.set(boundedDx);
    };

    const onEnd = (e: TouchEvent) => {
      if (!startRef.current || !isDraggingRef.current) {
        startRef.current = null;
        isDraggingRef.current = false;
        if (x.get() !== 0) {
          animate(x, 0, { type: "spring", stiffness: 400, damping: 35 });
        }
        return;
      }

      const dx = e.changedTouches[0].clientX - startRef.current.x;
      const currentIdx = ROUTES.indexOf(pathname);
      startRef.current = null;
      isDraggingRef.current = false;

      const screenWidth = window.innerWidth;
      const threshold = screenWidth * SWIPE_THRESHOLD_RATIO;

      if (dx < -threshold && currentIdx < ROUTES.length - 1) {
        // Swipe kiri → halaman berikutnya
        isNavigatingRef.current = true;
        animate(x, -screenWidth, {
          type: "tween",
          duration: 0.22,
          ease: [0.25, 0.46, 0.45, 0.94],
          onComplete: () => {
            x.set(screenWidth); // page baru masuk dari kanan
            router.push(ROUTES[currentIdx + 1]);
          },
        });
      } else if (dx > threshold && currentIdx > 0) {
        // Swipe kanan → halaman sebelumnya
        isNavigatingRef.current = true;
        animate(x, screenWidth, {
          type: "tween",
          duration: 0.22,
          ease: [0.25, 0.46, 0.45, 0.94],
          onComplete: () => {
            x.set(-screenWidth); // page baru masuk dari kiri
            router.push(ROUTES[currentIdx - 1]);
          },
        });
      } else {
        // Kurang jauh, spring balik
        animate(x, 0, {
          type: "spring",
          stiffness: 400,
          damping: 35,
        });
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [pathname, router, x]);

  return { x };
}

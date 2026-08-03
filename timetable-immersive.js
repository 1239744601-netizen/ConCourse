(() => {
  "use strict";

  const initializeTimetableImmersion = () => {
    const workspace = document.getElementById("appWrap");
    if (!workspace || workspace.querySelector(".planner-immersive-scene")) return;

    const scene = document.createElement("div");
    scene.className = "planner-immersive-scene";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = [
      '<div class="planner-scene-image planner-scene-base"></div>',
      '<div class="planner-scene-image planner-scene-reveal"></div>',
      '<canvas class="planner-particle-field"></canvas>'
    ].join("");
    workspace.prepend(scene);

    const canvas = scene.querySelector("canvas");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
    const saveData = Boolean(navigator.connection?.saveData);
    const viewport = { width: 0, height: 0, dpr: 1 };
    const pointer = {
      targetX: window.innerWidth * 0.5,
      targetY: window.innerHeight * 0.5,
      smoothX: window.innerWidth * 0.5,
      smoothY: window.innerHeight * 0.5,
      active: false
    };
    let particles = [];
    let focusElement = null;
    let frameId = 0;
    let lastFrame = 0;

    const routes = [
      [[-.06, .84], [.28, .76], [.56, .48], [1.06, .13]],
      [[-.05, .28], [.31, .09], [.61, .84], [1.05, .52]],
      [[.09, 1.04], [.34, .77], [.72, .54], [1.04, .31]]
    ];

    const isPlannerVisible = () => (
      !workspace.hidden &&
      document.body.classList.contains("app-active") &&
      !document.body.classList.contains("schedule-active") &&
      !document.body.classList.contains("hub-active")
    );

    const pointOnRoute = (route, progress) => {
      const inverse = 1 - progress;
      const x =
        inverse ** 3 * route[0][0] +
        3 * inverse ** 2 * progress * route[1][0] +
        3 * inverse * progress ** 2 * route[2][0] +
        progress ** 3 * route[3][0];
      const y =
        inverse ** 3 * route[0][1] +
        3 * inverse ** 2 * progress * route[1][1] +
        3 * inverse * progress ** 2 * route[2][1] +
        progress ** 3 * route[3][1];
      return { x: x * viewport.width, y: y * viewport.height };
    };

    const particleLimit = () => {
      if (saveData) return window.innerWidth < 760 ? 8 : 20;
      if (window.innerWidth < 760) return 16;
      if (window.innerWidth < 1120) return 36;
      return 64;
    };

    const resetParticles = () => {
      const count = particleLimit();
      particles = Array.from({ length: count }, (_, index) => ({
        route: index % routes.length,
        progress: (index / count + Math.random() * .16) % 1,
        speed: .000014 + Math.random() * .000018,
        radius: 1.1 + Math.random() * 2.6,
        phase: Math.random() * Math.PI * 2,
        tone: index % 7 === 0 ? "gold" : (index % 3 === 0 ? "ice" : "cyan")
      }));
    };

    const resizeCanvas = () => {
      viewport.width = Math.max(1, window.innerWidth);
      viewport.height = Math.max(1, window.innerHeight);
      viewport.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(viewport.width * viewport.dpr);
      canvas.height = Math.round(viewport.height * viewport.dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
      resetParticles();
      drawScene(performance.now(), true);
    };

    const resolvedFocus = () => {
      if (!focusElement?.isConnected) return null;
      const rect = focusElement.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return {
        x: rect.left + rect.width * .5,
        y: rect.top + rect.height * .5
      };
    };

    const drawRoute = (route, dayMode) => {
      const start = pointOnRoute(route, 0);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.bezierCurveTo(
        route[1][0] * viewport.width,
        route[1][1] * viewport.height,
        route[2][0] * viewport.width,
        route[2][1] * viewport.height,
        route[3][0] * viewport.width,
        route[3][1] * viewport.height
      );
      context.lineWidth = dayMode ? 1.15 : 1.1;
      context.strokeStyle = dayMode
        ? "rgba(20, 102, 155, .2)"
        : "rgba(126, 213, 255, .22)";
      context.stroke();
    };

    const drawScene = (now, staticFrame = false) => {
      if (!viewport.width || !viewport.height) return;
      const dayMode = document.documentElement.dataset.theme === "day";
      const focus = resolvedFocus();
      const attractor = focus || (pointer.active && !coarsePointer.matches
        ? { x: pointer.smoothX, y: pointer.smoothY }
        : null);
      const elapsed = lastFrame ? Math.min(40, now - lastFrame) : 16;
      lastFrame = now;

      context.clearRect(0, 0, viewport.width, viewport.height);
      context.save();
      context.globalCompositeOperation = dayMode ? "source-over" : "lighter";
      routes.forEach((route) => drawRoute(route, dayMode));

      const positions = particles.map((particle) => {
        if (!staticFrame && !reducedMotion.matches) {
          particle.progress = (particle.progress + particle.speed * elapsed) % 1;
        }
        const base = pointOnRoute(routes[particle.route], particle.progress);
        const drift = reducedMotion.matches ? 0 : Math.sin(now * .0007 + particle.phase) * 2.2;
        let x = base.x;
        let y = base.y + drift;

        if (attractor && !reducedMotion.matches) {
          const dx = attractor.x - x;
          const dy = attractor.y - y;
          const distance = Math.hypot(dx, dy);
          const influenceRadius = focus ? 250 : 180;
          if (distance > 0 && distance < influenceRadius) {
            const influence = (1 - distance / influenceRadius) ** 2;
            const pull = focus ? .085 : .065;
            x += dx * influence * pull;
            y += dy * influence * pull;
          }
        }
        const trail = pointOnRoute(
          routes[particle.route],
          Math.max(0, particle.progress - .014)
        );
        return { ...particle, x, y, trailX: trail.x, trailY: trail.y + drift };
      });

      routes.forEach((_, routeIndex) => {
        const routeParticles = positions
          .filter((particle) => particle.route === routeIndex)
          .sort((a, b) => a.progress - b.progress);
        routeParticles.forEach((particle, index) => {
          const next = routeParticles[index + 1];
          if (!next) return;
          const distance = Math.hypot(next.x - particle.x, next.y - particle.y);
          if (distance > 230) return;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(next.x, next.y);
          context.lineWidth = dayMode ? .85 : .9;
          context.strokeStyle = dayMode
            ? `rgba(16, 93, 145, ${Math.max(.05, .18 - distance / 2000)})`
            : `rgba(123, 214, 255, ${Math.max(.06, .25 - distance / 1400)})`;
          context.stroke();
        });
      });

      positions.forEach((particle) => {
        const distanceToPointer = attractor
          ? Math.hypot(attractor.x - particle.x, attractor.y - particle.y)
          : Infinity;
        const nearby = distanceToPointer < 180;
        const palette = dayMode
          ? { cyan: "#1479ad", ice: "#2d95c5", gold: "#a46d0a" }
          : { cyan: "#72d6ff", ice: "#d5f4ff", gold: "#f0bd50" };
        context.save();
        context.beginPath();
        context.moveTo(particle.trailX, particle.trailY);
        context.lineTo(particle.x, particle.y);
        context.lineCap = "round";
        context.lineWidth = nearby ? 2 : 1.15;
        context.strokeStyle = palette[particle.tone];
        context.globalAlpha = nearby ? .86 : (dayMode ? .38 : .5);
        context.shadowColor = palette[particle.tone];
        context.shadowBlur = nearby ? 16 : 6;
        context.stroke();
        context.restore();

        context.save();
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius + (nearby ? 1.25 : 0), 0, Math.PI * 2);
        context.fillStyle = palette[particle.tone];
        context.globalAlpha = nearby ? 1 : (dayMode ? .68 : .82);
        context.shadowColor = palette[particle.tone];
        context.shadowBlur = nearby ? 18 : 9;
        context.fill();
        context.restore();
      });

      if (pointer.active && !coarsePointer.matches && !reducedMotion.matches) {
        const halo = context.createRadialGradient(
          pointer.smoothX,
          pointer.smoothY,
          0,
          pointer.smoothX,
          pointer.smoothY,
          150
        );
        halo.addColorStop(0, dayMode ? "rgba(30, 137, 190, .08)" : "rgba(116, 219, 255, .1)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
        context.fillStyle = halo;
        context.fillRect(pointer.smoothX - 150, pointer.smoothY - 150, 300, 300);
      }
      context.restore();
    };

    const updatePointerPresentation = () => {
      const focus = resolvedFocus();
      const targetX = focus?.x ?? pointer.targetX;
      const targetY = focus?.y ?? pointer.targetY;
      const easing = focus ? .11 : .08;
      pointer.smoothX += (targetX - pointer.smoothX) * easing;
      pointer.smoothY += (targetY - pointer.smoothY) * easing;
      const shiftX = ((pointer.smoothX / viewport.width) - .5) * -10;
      const shiftY = ((pointer.smoothY / viewport.height) - .5) * -7;
      scene.style.setProperty("--planner-pointer-x", `${pointer.smoothX.toFixed(1)}px`);
      scene.style.setProperty("--planner-pointer-y", `${pointer.smoothY.toFixed(1)}px`);
      scene.style.setProperty("--planner-shift-x", `${shiftX.toFixed(2)}px`);
      scene.style.setProperty("--planner-shift-y", `${shiftY.toFixed(2)}px`);
    };

    const tick = (now) => {
      frameId = 0;
      if (!isPlannerVisible() || document.hidden || reducedMotion.matches) return;
      updatePointerPresentation();
      drawScene(now);
      frameId = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrame = 0;
    };

    const start = () => {
      if (!isPlannerVisible() || document.hidden) {
        stop();
        return;
      }
      if (!viewport.width || canvas.width === 0) resizeCanvas();
      if (reducedMotion.matches) {
        stop();
        updatePointerPresentation();
        drawScene(performance.now(), true);
        return;
      }
      if (!frameId) frameId = window.requestAnimationFrame(tick);
    };

    const handlePointerMove = (event) => {
      if (!isPlannerVisible() || coarsePointer.matches || reducedMotion.matches) return;
      pointer.targetX = event.clientX;
      pointer.targetY = event.clientY;
      pointer.active = true;
    };

    workspace.addEventListener("pointermove", handlePointerMove, { passive: true });
    workspace.addEventListener("pointerleave", () => {
      pointer.active = false;
      pointer.targetX = viewport.width * .5;
      pointer.targetY = viewport.height * .5;
    }, { passive: true });

    workspace.querySelectorAll(".selection-assistant-step, .selection-assistant-launch").forEach((element) => {
      element.addEventListener("pointerenter", () => {
        focusElement = element;
      });
      element.addEventListener("pointerleave", () => {
        if (focusElement === element) focusElement = null;
      });
      element.addEventListener("focusin", () => {
        focusElement = element;
        pointer.active = true;
      });
      element.addEventListener("focusout", () => {
        if (focusElement === element) focusElement = null;
      });
    });

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resizeCanvas();
        start();
      }, 100);
    }, { passive: true });

    document.addEventListener("visibilitychange", start);
    reducedMotion.addEventListener?.("change", () => {
      resizeCanvas();
      start();
    });

    const visibilityObserver = new MutationObserver(start);
    visibilityObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    visibilityObserver.observe(workspace, { attributes: true, attributeFilter: ["hidden"] });

    resizeCanvas();
    start();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeTimetableImmersion, { once: true });
  } else {
    initializeTimetableImmersion();
  }
})();

// One real-footage timeline: exterior → entrance → cabin → original LLC logo.
export function initHeroCinema() {
  const hero = document.getElementById("cinemaHero");
  if (!hero) return;
  const video = document.getElementById("heroJourney");
  const toggle = document.getElementById("heroPlay");
  const replay = document.getElementById("heroReplay");
  const label = document.getElementById("heroSceneLabel");
  const progress = document.getElementById("heroProgress");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const restricted = () => motion.matches || navigator.connection?.saveData;
  let visible = false,
    userPaused = false,
    finished = false,
    starting = false;
  function scene() {
    if (finished) {
      hero.dataset.scene = "brand";
      label.textContent = "04 / Welcome aboard";
      progress.style.transform = "scaleX(1)";
      return;
    }
    const t = video.currentTime;
    hero.dataset.scene =
      t >= 12.5 ? "cabin" : t >= 9.2 ? "entrance" : "exterior";
    label.textContent =
      t >= 12.5
        ? "03 / Step inside"
        : t >= 9.2
          ? "02 / Come aboard"
          : "01 / Meet the coach";
    progress.style.transform = `scaleX(${Math.min(1, t / (video.duration || 18.15))})`;
  }
  function buttons() {
    toggle.textContent = video.paused ? "Play experience" : "Pause experience";
    toggle.setAttribute("aria-label", toggle.textContent);
    toggle.hidden = finished;
    replay.hidden = !finished;
  }
  async function play() {
    if (starting || finished) return;
    starting = true;
    if (!video.getAttribute("src")) {
      video.src = video.dataset.src;
      video.load();
    }
    hero.dataset.loading = "true";
    try {
      await video.play();
      hero.dataset.loading = "false";
    } catch {
      hero.dataset.loading = "false";
      buttons();
    } finally {
      starting = false;
    }
  }
  toggle.addEventListener("click", () => {
    if (video.paused) {
      userPaused = false;
      play();
    } else {
      userPaused = true;
      video.pause();
    }
  });
  replay.addEventListener("click", () => {
    finished = false;
    userPaused = false;
    video.currentTime = 0;
    scene();
    buttons();
    play();
  });
  video.addEventListener("timeupdate", scene);
  video.addEventListener("playing", () => {
    hero.dataset.loading = "false";
    buttons();
  });
  video.addEventListener("pause", buttons);
  video.addEventListener("ended", () => {
    finished = true;
    scene();
    buttons();
  });
  video.addEventListener("error", () => {
    hero.dataset.loading = "false";
    hero.dataset.scene = "exterior";
    toggle.textContent = "Film unavailable";
    toggle.disabled = true;
    label.textContent = "Explore the fleet below";
  });
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      document.body.classList.toggle("hero-visible", visible);
      if (!visible) video.pause();
      else if (!restricted() && !userPaused && !finished && !document.hidden)
        play();
    },
    { threshold: 0.35 },
  );
  observer.observe(hero);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else if (visible && !restricted() && !userPaused && !finished) play();
  });
  const preferenceChanged = () => {
    if (restricted()) video.pause();
  };
  motion.addEventListener("change", preferenceChanged);
  navigator.connection?.addEventListener("change", preferenceChanged);
  scene();
  buttons();
  return {
    dispose() {
      observer.disconnect();
      video.pause();
      motion.removeEventListener("change", preferenceChanged);
      navigator.connection?.removeEventListener("change", preferenceChanged);
    },
  };
}
initHeroCinema();

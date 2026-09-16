/** Lazy-load shell images outside the critical titlebar path. */

export function imageLazyShell() {
  let observer = null;

  return {
    start() {
      const imgs = document.querySelectorAll(
        '#veil-sidebar img, #settings-panel img, .sidebar img, img[data-veil-lazy]',
      );
      if (!('IntersectionObserver' in window)) {
        imgs.forEach((img) => {
          if (img.dataset.src) img.src = img.dataset.src;
        });
        return;
      }
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          observer.unobserve(img);
        }
      });
      imgs.forEach((img) => {
        if (!img.dataset.src && img.src && !img.closest('#titlebar')) {
          img.loading = 'lazy';
        }
        observer.observe(img);
      });
    },
    stop() {
      observer?.disconnect();
      observer = null;
    },
  };
}

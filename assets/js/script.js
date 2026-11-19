(() => {
  'use strict';

  const ICONS = {
    // Google Material Symbols: arrow_outward (rotated to point bottom-right) / arrow_back / chevrons / close
    outward:
      '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path transform="rotate(90 480 -480)" d="m256-240-56-56 384-384H240v-80h480v480h-80v-344L256-240Z"/></svg>',
    back:
      '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z"/></svg>',
    prev:
      '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>',
    next:
      '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>',
    close:
      '<svg viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
  };

  const CATEGORY = {
    project: { view: 'projects', label: 'Project', plural: 'projects' },
    initiative: { view: 'initiatives', label: 'Initiative', plural: 'initiatives' },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ---------- Markdown (for text values in the JSON files) ----------
     Supports: [link](url), **bold**, *italic* / _italic_, line breaks,
     blank-line paragraphs and "- " bullet lists. Raw HTML is escaped. */

  const safeUrl = (url) => (/^\s*(javascript|data|vbscript):/i.test(url) ? '#' : url.trim());

  function mdInline(text, { links = true } = {}) {
    const stash = [];
    let s = escapeHtml(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const href = safeUrl(url.replace(/&amp;/g, '&'));
      const external = /^(https?:)?\/\//i.test(href);
      stash.push({ label, a: `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>` });
      return `\u0000${stash.length - 1}\u0000`;
    });
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?![\w*])/g, '$1<em>$2</em>');
    // Labels are formatted too, so "[**bold link**](url)" works.
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => {
      const { label, a } = stash[i];
      const inner = mdInline(label.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"), { links: false });
      return links ? `${a}${inner}</a>` : inner;
    });
    return s.replace(/\n/g, '<br />');
  }

  function mdBlock(text) {
    return String(text ?? '')
      .trim()
      .split(/\n\s*\n/)
      .map((block) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return `<ul>${lines.map((l) => `<li>${mdInline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
        }
        return `<p>${mdInline(block)}</p>`;
      })
      .join('');
  }

  const mdPlain = (text) =>
    String(text ?? '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|[*_])/g, '');

  let projects = [];

  /* ---------- Data helpers ---------- */

  // Accepts [lat, lng] or [[lat, lng], [lat, lng], ...]
  const coordsOf = (p) => {
    const c = p.coordinates;
    if (!Array.isArray(c) || !c.length) return [];
    return typeof c[0] === 'number' ? [c] : c.filter((pair) => Array.isArray(pair) && pair.length === 2);
  };

  // Blue-ish card colours get the secondary (blue) text colour, everything else the primary green.
  const textColorFor = (p) => {
    if (p.textColor) return p.textColor;
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(p.color || '');
    if (!m) return 'var(--primary)';
    const [r, g, b] = m.slice(1).map((h) => parseInt(h, 16));
    return b >= r && b >= g ? 'var(--secondary)' : 'var(--primary)';
  };

  const tagOf = (p) => [p.location, p.year].filter(Boolean).join(' · ');

  const cardStyle = (p) => `--card-color:${escapeHtml(p.color || '#5E719A')};--card-text:${textColorFor(p)}`;

  /**
   * variant: 'link' (overview grid), 'popup' (map), 'static' (detail page)
   */
  function cardHTML(p, variant, i = 0) {
    const inner = `
      <div class="card__media"><img src="${escapeHtml(p.image)}" alt="" ${variant === 'link' ? 'loading="lazy"' : ''} /></div>
      <div class="card__body">
        ${variant !== 'static' ? `<span class="card__tag">${escapeHtml(tagOf(p))}</span>` : ''}
        <h3 class="card__title">${mdInline(p.title, { links: false })}</h3>
        <p class="card__sub"><span>${mdInline(p.subtitle, { links: false })}</span></p>
        ${variant !== 'static' ? `<span class="card__arrow">${ICONS.outward}</span>` : ''}
      </div>`;
    if (variant === 'static') {
      return `<div class="card card--static" style="${cardStyle(p)}">${inner}</div>`;
    }
    const cls = variant === 'popup' ? 'card card--popup' : 'card card--link reveal';
    return `<a class="${cls}" href="#project/${encodeURIComponent(p.slug)}" style="${cardStyle(p)};--i:${i % 2}"
      aria-label="${escapeHtml(`${mdPlain(p.title)} – ${tagOf(p)}`)}">${inner}</a>`;
  }

  /* ---------- Reveal on scroll ---------- */

  const revealObserver =
    'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add('is-visible');
                revealObserver.unobserve(e.target);
              }
            });
          },
          { rootMargin: '0px 0px -8% 0px' }
        )
      : null;

  function observeReveals(root = document) {
    $$('.reveal:not(.is-visible)', root).forEach((el) => {
      const r = el.getBoundingClientRect();
      const inView = r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
      if (inView || !revealObserver) el.classList.add('is-visible');
      else revealObserver.observe(el);
    });
  }

  /* ---------- Overview grids ---------- */

  function renderGrids() {
    $$('[data-grid]').forEach((grid) => {
      const items = projects.filter((p) => p.category === grid.dataset.grid);
      grid.innerHTML = items.length
        ? items.map((p, i) => cardHTML(p, 'link', i)).join('')
        : '<p class="notice">Nothing here yet.</p>';
    });
    observeReveals();
  }

  /* ---------- Detail ---------- */

  let tocObserver = null;

  const labelOf = (key) => {
    const s = key.replace(/[_-]+/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  function renderDetail(slug) {
    const root = $('[data-detail]');
    if (tocObserver) tocObserver.disconnect();

    const p = projects.find((item) => item.slug === slug);
    if (!p) {
      root.innerHTML = `<p class="notice">This project could not be found. <a class="text-link" href="#projects">Back to projects</a></p>`;
      return null;
    }

    const cat = CATEGORY[p.category] || CATEGORY.project;
    const siblings = projects.filter((item) => item.category === p.category);
    const idx = siblings.indexOf(p);
    const prev = siblings[(idx - 1 + siblings.length) % siblings.length];
    const next = siblings[(idx + 1) % siblings.length];

    const rows = Object.entries(p.table || {})
      .filter(([, v]) => v)
      .map(
        ([k, v]) =>
          `<div class="overview__row"><dt>${escapeHtml(labelOf(k))}</dt><dd>${mdInline(v)}</dd></div>`
      )
      .join('');

    const bodyItems = Array.isArray(p.body) ? p.body : [];
    const sections = bodyItems.filter((item) => item.type !== 'image' && item.type !== 'details');
    let sectionIndex = 0;
    const article = bodyItems
      .map((item) => {
        if (item.type === 'youtube') {
          const i = sectionIndex++;
          const videoId = typeof item.videoId === 'string' ? item.videoId.trim() : '';
          if (!/^[\w-]{11}$/.test(videoId)) {
            return '<p class="notice">This video has an invalid YouTube video ID.</p>';
          }
          const title = item.title || 'YouTube video';
          return `
            <figure class="article__video" id="section-${i}">
              <button class="video-preview" type="button" data-youtube-play="${videoId}" aria-label="Play video: ${escapeHtml(title)}">
                <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="" loading="lazy" />
                <span class="video-preview__play" aria-hidden="true"></span>
              </button>
              ${item.caption ? `<figcaption>${mdInline(item.caption)}</figcaption>` : ''}
            </figure>`;
        }

        if (item.type === 'image') {
          const image = escapeHtml(encodeURI(item.image.trim()));
          const caption = item.caption ? mdInline(item.caption) : '';
          return `
            <figure class="article__image reveal">
              <img src="${image}" alt="${escapeHtml(mdPlain(item.caption))}" loading="lazy" />
              ${caption ? `<figcaption>${caption}</figcaption>` : ''}
            </figure>`;
        }

        if (item.type === 'details') {
          return `
            <details class="article__details reveal">
              <summary>${mdInline(item.summary, { links: false })}</summary>
              ${mdBlock(item.text)}
            </details>`;
        }

        const i = sectionIndex++;
        return `
          <section class="article__section reveal" id="section-${i}">
            <h2>${mdInline(item.heading, { links: false })}</h2>
            ${mdBlock(item.text)}
          </section>`;
      })
      .join('');

    const tocItems = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.type !== 'youtube' && section.heading);
    const toc = tocItems
      .map(({ section, index }) => {
        const label = section.heading || (section.type === 'youtube' ? section.title || 'Video' : '');
        return `<li><button type="button" data-toc="${index}">${mdInline(label, { links: false })}</button></li>`;
      })
      .join('');

    const images = (Array.isArray(p.images) ? p.images : []).filter((item) => item && typeof item.image === 'string' && item.image.trim());
    const tocHTML =
      tocItems.length > 1
        ? `<nav class="toc" aria-label="On this page"><p class="toc__label">On this page</p><ol>${toc}</ol></nav>`
        : '';
    const galleryHTML = images.length
      ? `<div class="gallery">${images
          .map(
            (item) => `
            <figure class="gallery__item">
              <img src="${escapeHtml(encodeURI(item.image.trim()))}" alt="${escapeHtml(mdPlain(item.caption))}" loading="lazy" />
              ${item.caption ? `<figcaption>${mdInline(item.caption)}</figcaption>` : ''}
            </figure>`
          )
          .join('')}</div>`
      : '';

    root.innerHTML = `
      <article class="detail">
        <a class="back-link" href="#${cat.view}" aria-label="Back to ${cat.plural}">${ICONS.back}</a>
        <div class="detail__top">
          ${cardHTML(p, 'static')}
          <div>
            <h1 class="detail__title">${cat.label} Overview</h1>
            <dl class="overview">${rows}</dl>
          </div>
        </div>
        <div class="detail__content">
          <div class="article">${article}</div>
          ${tocHTML || galleryHTML ? `<aside class="detail__aside">${tocHTML}${galleryHTML}</aside>` : ''}
        </div>
        ${
          siblings.length > 1
            ? `<nav class="pager" aria-label="More ${cat.plural}">
                <a class="pager__prev" href="#project/${encodeURIComponent(prev.slug)}"><small>← Previous</small>${mdInline(prev.title, { links: false })}</a>
                <a class="pager__next" href="#project/${encodeURIComponent(next.slug)}"><small>Next →</small>${mdInline(next.title, { links: false })}</a>
              </nav>`
            : ''
        }
      </article>`;

    $$('[data-toc]', root).forEach((btn) =>
      btn.addEventListener('click', () => {
        document.getElementById(`section-${btn.dataset.toc}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );

    $$('[data-youtube-play]', root).forEach((button) =>
      button.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube-nocookie.com/embed/${button.dataset.youtubePlay}?autoplay=1`;
        iframe.title = button.getAttribute('aria-label')?.replace(/^Play video: /, '') || 'YouTube video';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        button.replaceWith(iframe);
      })
    );

    if ('IntersectionObserver' in window && sections.length > 1) {
      tocObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (!e.isIntersecting) return;
            const i = e.target.id.split('-')[1];
            $$('[data-toc]', root).forEach((b) => b.classList.toggle('is-current', b.dataset.toc === i));
          });
        },
        { rootMargin: '-25% 0px -60% 0px' }
      );
      $$('.article__section', root).forEach((s) => tocObserver.observe(s));
    }

    $$('.gallery img', root).forEach((img) => img.addEventListener('load', fadeGallery));
    requestAnimationFrame(fadeGallery);

    observeReveals(root);
    return p;
  }

  /* ---------- Detail gallery: fade images in / out on scroll ----------
     An image (with its caption) fades in while it rises from the bottom of the viewport and
     fades out while it slides up under the sticky "On this page" box (or the header). */

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  function fadeGallery() {
    const items = $$('[data-detail] .gallery__item');
    if (!items.length) return;
    const vh = window.innerHeight;
    const toc = $('[data-detail] .toc');
    const tocBottom = toc && toc.offsetParent ? toc.getBoundingClientRect().bottom : 0;
    const top = Math.max(tocBottom, $('.site-header')?.getBoundingClientRect().bottom || 0);

    items.forEach((item) => {
      const r = item.getBoundingClientRect();
      if (!r.height) return;
      const fadeIn = (vh - r.top) / Math.min(r.height, vh * 0.4);
      const fadeOut = 1 - (top - r.top) / r.height;
      item.style.opacity = clamp01(Math.min(fadeIn, fadeOut)).toFixed(3);
    });
  }

  window.addEventListener('scroll', fadeGallery, { passive: true });
  window.addEventListener('resize', fadeGallery);

  /* ---------- World map ---------- */

  const MAP = (() => {
    // Equal Earth projection (Šavrič, Patterson & Jenny 2018) – equal-area, so Africa and South America
    // keep their true relative size. Cropped to lat 84°N – 57°S (no Antarctica).
    const equalEarth = (lat, lng) => {
      const [A1, A2, A3, A4, M] = [1.340264, -0.081106, 0.000893, 0.003796, Math.sqrt(3) / 2];
      const t = Math.asin(M * Math.sin((lat * Math.PI) / 180));
      const t2 = t * t;
      const t6 = t2 * t2 * t2;
      const x = ((lng * Math.PI) / 180) * Math.cos(t) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
      const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
      return [x, y];
    };
    const W = 1000;
    const X_MAX = equalEarth(0, 180)[0];
    const K = W / (2 * X_MAX);
    const TOP = equalEarth(84, 0)[1] * K;
    const H = TOP - equalEarth(-57, 0)[1] * K;
    const project = (lat, lng) => {
      const [x, y] = equalEarth(lat, lng);
      return [W / 2 + x * K, TOP - y * K];
    };

    const CLUSTER_PX = 18;

    const el = $('[data-map]');
    const canvas = $('.map__canvas', el);
    const land = $('[data-map-land]', el);
    const links = $('[data-map-links]', el);
    const markersEl = $('[data-map-markers]', el);
    const popup = $('[data-map-popup]', el);

    const filters = new Set(['project', 'initiative']);
    let points = [];
    let clusters = [];
    let pinned = null; // { cluster, index }
    let preview = null;
    let hideTimer = null;

    async function drawLand() {
      land.setAttribute('viewBox', `0 0 ${W} ${H.toFixed(1)}`);
      el.closest('.map-section').style.setProperty('--map-ratio', (W / H).toFixed(4));
      try {
        const res = await fetch('assets/map/world-land.json');
        const geo = await res.json();
        const d = geo.coordinates
          .flat()
          .filter((ring) => ring.some(([, lat]) => lat > -60))
          .map(
            (ring) =>
              'M' +
              ring
                .map(([lng, lat]) => project(lat, lng))
                .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
                .join('L') +
              'Z'
          )
          .join('');
        land.innerHTML = `<path d="${d}" />`;
      } catch (err) {
        console.warn('World map could not be loaded', err);
      }
    }

    function setData(list) {
      points = [];
      list.forEach((p) => {
        coordsOf(p).forEach(([lat, lng]) => {
          const [x, y] = project(lat, lng);
          points.push({ p, fx: x / W, fy: y / H });
        });
      });
      layout();
    }

    function layout() {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return; // map not visible yet

      clusters = [];
      points
        .filter((pt) => filters.has(pt.p.category))
        .forEach((pt) => {
          const px = pt.fx * w;
          const py = pt.fy * h;
          const hit = clusters.find((c) => Math.hypot(c.x - px, c.y - py) < CLUSTER_PX);
          if (hit) {
            hit.pts.push(pt);
            hit.x = hit.pts.reduce((s, q) => s + q.fx * w, 0) / hit.pts.length;
            hit.y = hit.pts.reduce((s, q) => s + q.fy * h, 0) / hit.pts.length;
          } else {
            clusters.push({ x: px, y: py, pts: [pt] });
          }
        });
      clusters.forEach((c) => {
        c.items = [...new Set(c.pts.map((pt) => pt.p))];
        c.key = c.items.map((p) => p.slug).join('|');
      });

      markersEl.innerHTML = clusters
        .map((c, i) => {
          const cats = new Set(c.items.map((p) => p.category));
          const type = cats.size > 1 ? 'mixed' : [...cats][0];
          const many = c.items.length > 1;
          const label = many
            ? `${c.items.length} entries at this location`
            : `${c.items[0].location}: ${mdPlain(c.items[0].title)}`;
          return `<button type="button" class="marker marker--${type}${many ? ' marker--cluster' : ''}"
            style="left:${((c.x / w) * 100).toFixed(3)}%;top:${((c.y / h) * 100).toFixed(3)}%;--i:${i}"
            data-cluster="${i}" aria-label="${escapeHtml(label)}">${many ? c.items.length : ''}</button>`;
        })
        .join('');

      // Re-attach pinned state to the newly computed clusters.
      if (pinned) {
        const slug = pinned.cluster.items[pinned.index].slug;
        const c = clusters.find((cl) => cl.items.some((p) => p.slug === slug));
        if (c) {
          pinned = { cluster: c, index: c.items.findIndex((p) => p.slug === slug) };
          show(pinned, true);
        } else {
          close();
        }
      } else {
        hide();
      }
    }

    function markerFor(cluster) {
      return markersEl.children[clusters.indexOf(cluster)];
    }

    function show(state, isPinned) {
      clearTimeout(hideTimer);
      const { cluster, index } = state;
      const p = cluster.items[index];
      const many = cluster.items.length > 1;

      popup.innerHTML = `
        <div class="map__popup-bar" ${many || isPinned ? '' : 'hidden'}>
          <span>${many ? `${index + 1} / ${cluster.items.length} at this location` : ''}</span>
          <span class="map__pager">
            ${
              many
                ? `<button type="button" class="icon-btn" data-step="-1" aria-label="Previous entry">${ICONS.prev}</button>
                   <button type="button" class="icon-btn" data-step="1" aria-label="Next entry">${ICONS.next}</button>`
                : ''
            }
            ${isPinned ? `<button type="button" class="icon-btn" data-close aria-label="Close">${ICONS.close}</button>` : ''}
          </span>
        </div>
        ${cardHTML(p, 'popup')}`;
      popup.hidden = false;
      popup.classList.toggle('is-left', cluster.x > canvas.clientWidth * 0.55);

      $$('.marker', markersEl).forEach((m) => m.classList.remove('is-active'));
      // Highlight every marker that belongs to this project (multi-location projects).
      clusters.forEach((c) => {
        if (c.items.includes(p)) markerFor(c)?.classList.add('is-active');
      });

      drawLinks(cluster, p);
    }

    function drawLinks(cluster, p) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const svgParts = [];

      // Dashed connections between all locations of a multi-location project.
      const spots = clusters.filter((c) => c.items.includes(p));
      for (let i = 1; i < spots.length; i++) {
        svgParts.push(`<line x1="${spots[0].x}" y1="${spots[0].y}" x2="${spots[i].x}" y2="${spots[i].y}" />`);
      }

      // Connector from the active dot to the popup card.
      if (!popup.hidden && getComputedStyle(popup).position === 'absolute') {
        const cr = canvas.getBoundingClientRect();
        const pr = popup.getBoundingClientRect();
        const rect = { l: pr.left - cr.left, t: pr.top - cr.top, r: pr.right - cr.left, b: pr.bottom - cr.top };
        const inside = cluster.x > rect.l && cluster.x < rect.r && cluster.y > rect.t && cluster.y < rect.b;
        if (!inside) {
          const ex = Math.min(Math.max(cluster.x, rect.l), rect.r);
          const ey = Math.min(Math.max(cluster.y, rect.t), Math.min(rect.b, h));
          svgParts.push(`<line x1="${cluster.x}" y1="${cluster.y}" x2="${ex}" y2="${ey}" />`);
          svgParts.push(`<circle cx="${ex}" cy="${ey}" r="2.5" />`);
        }
      }
      links.setAttribute('viewBox', `0 0 ${w} ${h}`);
      links.innerHTML = svgParts.join('');
    }

    function hide() {
      popup.hidden = true;
      popup.innerHTML = '';
      links.innerHTML = '';
      $$('.marker', markersEl).forEach((m) => m.classList.remove('is-active'));
    }

    function close() {
      pinned = null;
      preview = null;
      hide();
    }

    function scheduleRestore() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        preview = null;
        if (pinned) show(pinned, true);
        else hide();
      }, 220);
    }

    function bind() {
      markersEl.addEventListener('mouseover', (e) => {
        const m = e.target.closest('.marker');
        if (!m) return;
        const c = clusters[m.dataset.cluster];
        if (pinned && pinned.cluster === c) return show(pinned, true);
        preview = { cluster: c, index: 0 };
        show(preview, false);
      });
      markersEl.addEventListener('mouseout', (e) => {
        if (e.target.closest('.marker')) scheduleRestore();
      });
      markersEl.addEventListener('focusin', (e) => {
        const m = e.target.closest('.marker');
        if (m && !pinned) show({ cluster: clusters[m.dataset.cluster], index: 0 }, false);
      });
      markersEl.addEventListener('click', (e) => {
        const m = e.target.closest('.marker');
        if (!m) return;
        e.stopPropagation();
        const c = clusters[m.dataset.cluster];
        if (!pinned || pinned.cluster !== c) pinned = { cluster: c, index: 0 };
        show(pinned, true);
      });

      popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
      popup.addEventListener('mouseleave', () => {
        if (preview && !pinned) scheduleRestore();
      });
      popup.addEventListener('click', (e) => {
        const step = e.target.closest('[data-step]');
        if (step) {
          const state = pinned || preview;
          const n = state.cluster.items.length;
          pinned = { cluster: state.cluster, index: (state.index + Number(step.dataset.step) + n) % n };
          show(pinned, true);
          return;
        }
        if (e.target.closest('[data-close]')) close();
      });

      canvas.addEventListener('click', (e) => {
        if (!e.target.closest('.marker')) close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
      });

      $$('[data-filter]').forEach((btn) =>
        btn.addEventListener('click', () => {
          const f = btn.dataset.filter;
          if (filters.has(f) && filters.size === 1) return; // keep at least one category visible
          filters.has(f) ? filters.delete(f) : filters.add(f);
          btn.classList.toggle('is-on', filters.has(f));
          btn.setAttribute('aria-pressed', filters.has(f));
          close();
          layout();
        })
      );

      let t;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(layout, 120);
      });
    }

    drawLand();
    bind();
    return { setData, layout, close };
  })();

  /* ---------- Scroll stack (About view) ---------- */

  const STACK = (() => {
    const root = $('.stack');
    const nav = $('[data-stack-nav]');
    if (!root) return { refresh() {}, setVisible() {} };

    const panels = $$('.stack__panel', root);
    const header = $('.site-header');
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const isStacked = () => getComputedStyle(panels[0]).position === 'sticky';

    function measure() {
      document.documentElement.style.setProperty('--vw', `${document.documentElement.clientWidth}px`);
      root.style.setProperty('--header-h', `${header.offsetHeight}px`);
    }

    function update() {
      if (root.hidden) return;
      const top = header.offsetHeight;
      const vh = window.innerHeight;
      const stacked = isStacked();
      let current = 0;

      panels.forEach((panel, i) => {
        if (panel.getBoundingClientRect().top <= top + vh * 0.45) current = i;
        const inner = $(':scope > .stack__inner', panel);
        const next = panels[i + 1];
        if (!inner) return;
        // 0 = next panel still below the fold, 1 = next panel fully covers this one
        const p = stacked && next ? clamp01((vh - next.getBoundingClientRect().top) / (vh - top)) : 0;
        inner.style.transform = p ? `scale(${(1 - 0.06 * p).toFixed(4)})` : '';
        inner.style.opacity = p ? (1 - 0.7 * p).toFixed(3) : '';
      });

      if (nav) $$('[data-stack-goto]', nav).forEach((b, i) => b.classList.toggle('is-current', i === current));
    }

    // Sticky panels report their stuck position, so derive natural positions backwards from the
    // last (non-sticky) panel.
    function goto(i) {
      const last = panels[panels.length - 1];
      const lastTop = last.getBoundingClientRect().top + window.scrollY;
      const naturalTop = lastTop - panels.slice(i, -1).reduce((sum, p) => sum + p.offsetHeight, 0);
      const target = i === 0 ? 0 : naturalTop - header.offsetHeight;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-stack-goto]');
      if (btn) goto(Number(btn.dataset.stackGoto));
    });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', () => {
      measure();
      update();
    });
    // Header height changes once web fonts load.
    if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe(header);

    return {
      refresh() {
        measure();
        update();
      },
      setVisible(on) {
        if (nav) nav.hidden = !on;
      },
    };
  })();

  /* ---------- Photo card stack (About intro) ---------- */

  function photoStack(root, photos) {
    const deck = $('[data-photo-cards]', root);
    const count = $('[data-photo-count]', root);
    const [prevBtn, nextBtn] = $$('[data-photo-step]', root);
    prevBtn.innerHTML = ICONS.prev;
    nextBtn.innerHTML = ICONS.next;

    deck.innerHTML = photos
      .map(
        (ph, i) =>
          `<figure class="photo-card"><img src="${escapeHtml(ph.src)}" alt="${escapeHtml(ph.alt || '')}" draggable="false" ${i > 2 ? 'loading="lazy"' : ''} /></figure>`
      )
      .join('');
    const cards = $$('.photo-card', deck);
    let order = cards.map((_, i) => i); // order[0] is the card on top
    const VISIBLE = 4;

    // Back cards fan out to the right with increasing tilt (Swiper "cards" look);
    // cards beyond VISIBLE sit hidden behind the last visible one.
    function layout() {
      order.forEach((idx, pos) => {
        const c = cards[idx];
        const k = Math.min(pos, VISIBLE - 1);
        c.style.zIndex = String(cards.length - pos);
        c.style.transform = `translate(${k * 18}px, ${k * 6}px) rotate(${3 + k * 4}deg) scale(${1 - k * 0.04})`;
        c.style.opacity = pos < VISIBLE ? '1' : '0';
        c.setAttribute('aria-hidden', pos === 0 ? 'false' : 'true');
      });
      count.textContent = `${order[0] + 1} / ${cards.length}`;
    }

    function step(dir, flyX = dir > 0 ? -520 : 520) {
      if (dir > 0) {
        const top = cards[order[0]];
        top.style.transform = `translate(${flyX}px, 40px) rotate(${flyX > 0 ? 24 : -24}deg)`;
        order.push(order.shift());
        // let the fly-out start before the card is sent to the back
        setTimeout(layout, 180);
      } else {
        order.unshift(order.pop());
        layout();
      }
    }

    let drag = null;
    deck.addEventListener('pointerdown', (e) => {
      const top = cards[order[0]];
      if (!top.contains(e.target)) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, card: top };
      top.classList.add('is-dragging');
      deck.setPointerCapture(e.pointerId);
    });
    deck.addEventListener('pointermove', (e) => {
      if (!drag) return;
      drag.dx = e.clientX - drag.x;
      const dy = (e.clientY - drag.y) * 0.3;
      drag.card.style.transform = `translate(${drag.dx}px, ${dy}px) rotate(${3 + drag.dx * 0.06}deg)`;
    });
    const endDrag = () => {
      if (!drag) return;
      const { dx, card } = drag;
      card.classList.remove('is-dragging');
      drag = null;
      if (Math.abs(dx) > 70) step(1, dx > 0 ? 520 : -520);
      else if (Math.abs(dx) < 4) step(1);
      else layout();
    };
    deck.addEventListener('pointerup', endDrag);
    deck.addEventListener('pointercancel', endDrag);
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));

    layout();
  }

  /* ---------- About content (about.json) ---------- */

  const IMAGE_RE = /\.(jpe?g|png|webp|avif|gif)$/i;
  const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

  /**
   * Lists all images in a folder, so new photos show up without editing any file.
   * 1. Directory listing of the web server (python -m http.server, VS Code Live Server, …)
   * 2. On GitHub Pages (<user>.github.io/<repo>/): the public GitHub contents API
   * Images are sorted by file name – prefix names with 01_, 02_, … to control the order.
   */
  async function listPhotos(folder) {
    const dir = folder.replace(/^\.?\/+|\/+$/g, '');
    const toUrls = (names) => [...new Set(names)].sort(byName).map((n) => `${dir}/${encodeURIComponent(n)}`);

    try {
      if (location.protocol === 'file:') throw new Error('no directory listing for file://');
      const res = await fetch(`${dir}/`, { cache: 'no-cache' });
      if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        const names = $$('a[href]', doc)
          .map((a) => decodeURIComponent(a.getAttribute('href').split(/[?#]/)[0]).split('/').filter(Boolean).pop() || '')
          .filter((n) => IMAGE_RE.test(n));
        if (names.length) return toUrls(names);
      }
    } catch (e) {
      /* no directory listing – try the next source */
    }

    const gh = /^([^.]+)\.github\.io$/i.exec(location.hostname);
    if (gh) {
      const first = location.pathname.split('/').filter(Boolean)[0];
      const repo = first && !first.includes('.') ? first : `${gh[1]}.github.io`;
      const res = await fetch(`https://api.github.com/repos/${gh[1]}/${repo}/contents/${dir}`);
      if (res.ok) {
        const files = await res.json();
        return toUrls(files.filter((f) => f.type === 'file' && IMAGE_RE.test(f.name)).map((f) => f.name));
      }
    }
    return [];
  }

  function renderAbout(data) {
    const intro = data.intro || {};
    const set = (key, html) => {
      const el = $(`[data-about="${key}"]`);
      if (el) el.innerHTML = html;
    };
    set('heading', mdInline(intro.heading, { links: false }));
    set('text', mdBlock(intro.text));
    set('contact', mdInline(intro.contact));

    const stackEl = $('[data-photo-stack]');
    if (stackEl) {
      listPhotos(intro.photoFolder || 'content/photos/about_me')
        .then((srcs) => {
          if (!srcs.length) {
            // Folders can't be listed for pages opened straight from disk.
            if (location.protocol === 'file:') {
              stackEl.hidden = false;
              stackEl.innerHTML =
                '<p class="notice">Photos appear when the site runs on a web server – e.g. run <code>python -m http.server</code> in this folder and open <code>http://localhost:8000</code>.</p>';
            }
            return;
          }
          stackEl.hidden = false;
          photoStack(
            stackEl,
            srcs.map((src, i) => ({ src, alt: `Photo of Johanna (${i + 1} of ${srcs.length})` }))
          );
        })
        .catch((err) => console.warn('Photos could not be listed', err));
    }

    const entryHTML = (en) => {
      const head = `
        ${en.meta ? `<span class="cv-entry__meta">${mdInline(en.meta)}</span>` : ''}
        ${en.label ? `<span class="cv-entry__label">${mdInline(en.label)}</span>` : ''}
        ${en.title ? `<span class="cv-entry__title">${mdInline(en.title)}</span>` : ''}
        ${en.organisation ? `<span class="job__org">${mdInline(en.organisation)}</span>` : ''}`;
      const text = en.text ? `<div class="cv-entry__text">${mdBlock(en.text)}</div>` : '';
      if (en.details) {
        return `<details class="job"><summary>${head}</summary>${text}<div class="job__details">${mdBlock(en.details)}</div></details>`;
      }
      return `<div class="cv-entry">${head}${text}</div>`;
    };

    $$('[data-cv-col]').forEach((col) => {
      col.innerHTML = (data.sections || [])
        .filter((s) => (s.column || 'left') === col.dataset.cvCol)
        .map(
          (s) => `
          <section class="cv-block">
            <h2 class="section-title">${mdInline(s.heading, { links: false })}</h2>
            ${(s.entries || []).map(entryHTML).join('')}
          </section>`
        )
        .join('');
    });
  }

  /* ---------- Router ---------- */

  const TITLES = { about: 'About', projects: 'Projects', initiatives: 'Initiatives' };

  function parseRoute() {
    const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (hash.startsWith('project/')) return { view: 'detail', slug: hash.slice(8) };
    if (TITLES[hash]) return { view: hash };
    return { view: 'about' };
  }

  let currentView = null;

  function route() {
    const r = parseRoute();
    let crumb = r.view;
    let title = TITLES[r.view];

    if (r.view === 'detail') {
      const p = renderDetail(r.slug);
      crumb = p ? (CATEGORY[p.category] || CATEGORY.project).view : null;
      title = p ? mdPlain(p.title) : 'Not found';
    }
    if (r.view !== 'about') MAP.close();

    $$('.view').forEach((v) => {
      const active = v.dataset.view === r.view;
      v.hidden = !active;
      v.classList.toggle('is-entering', active);
    });
    $$('[data-crumb]').forEach((a) => {
      if (a.dataset.crumb === crumb) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.title = `Johanna Weigel | ${title}`;

    if (currentView !== null) window.scrollTo({ top: 0, behavior: 'instant' });
    currentView = r.view;

    STACK.setVisible(r.view === 'about');
    if (r.view === 'about') {
      STACK.refresh();
      MAP.layout();
    }
    observeReveals();
  }

  /* ---------- Global behaviour ---------- */

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    // Placeholder links ("#") must not trigger the hash router.
    if (a.getAttribute('href') === '#') e.preventDefault();
    if (a.hasAttribute('data-skip')) {
      e.preventDefault();
      $('#main').focus();
    }
  });

  const header = $('.site-header');
  window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 8), { passive: true });

  $('[data-year]').textContent = new Date().getFullYear();

  /* ---------- Boot ---------- */

  async function loadJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  }

  // The category of each entry comes from the file it is stored in.
  async function loadProjects() {
    const [proj, init] = await Promise.all([loadJson('content/projects.json'), loadJson('content/initiatives.json')]);
    if (!Array.isArray(proj) || !Array.isArray(init)) throw new Error('projects.json and initiatives.json must contain lists');
    return [
      ...proj.map((p) => ({ ...p, category: 'project' })),
      ...init.map((p) => ({ ...p, category: 'initiative' })),
    ];
  }

  function showLoadError() {
    const msg =
      location.protocol === 'file:'
        ? 'The content could not be loaded because the page was opened directly from disk. Start a local web server in this folder (e.g. <code>python -m http.server</code>) and open <code>http://localhost:8000</code>.'
        : 'The content could not be loaded. Please try again later.';
    $$('[data-grid], [data-detail]').forEach((el) => (el.innerHTML = `<p class="notice">${msg}</p>`));
    $('[data-map-markers]').innerHTML = '';
    $('.map-hint').innerHTML = msg;
  }

  window.addEventListener('hashchange', route);

  const aboutLoaded = loadJson('content/about.json')
    .then(renderAbout)
    .catch((err) => {
      console.error(err);
      showLoadError();
    });

  const projectsLoaded = loadProjects()
    .then((data) => {
      projects = data;
      renderGrids();
      MAP.setData(projects);
    })
    .catch((err) => {
      console.error(err);
      showLoadError();
    });

  Promise.all([aboutLoaded, projectsLoaded]).finally(() => {
    route();
    observeReveals();
  });
})();

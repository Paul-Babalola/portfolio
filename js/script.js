/* ── Theme (runs before paint) ──────────────────────────── */
(function () {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

/* ── DOM ready ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

    /* Register GSAP plugins */
    if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
    }

    /* ── Theme toggle ──────────────────────────────────── */
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });

    /* ── Smooth scroll ─────────────────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    /* ── Scroll progress bar ───────────────────────────── */
    const progressBar = document.getElementById('scrollProgress');
    function updateProgress() {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
        progressBar.style.width = pct + '%';
    }

    /* ── Nav: frosted glass on scroll ─────────────────── */
    const nav = document.querySelector('nav');
    function onScroll() {
        nav.classList.toggle('scrolled', window.scrollY > 40);
        updateProgress();

        const scrollCue = document.getElementById('scrollCue');
        if (scrollCue) {
            const threshold = (document.documentElement.scrollHeight - window.innerHeight) * 0.1;
            scrollCue.classList.toggle('hidden', window.scrollY > threshold);
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Nav: RubberSegment indicator + active section ─── */
    const navLinks     = document.querySelectorAll('.nav-links li a');
    const sections     = document.querySelectorAll('section[id]');
    const indicatorEl  = document.getElementById('navIndicator');
    const navLinksEl   = document.getElementById('navLinks');

    const rubber = (window.initRubberSegment && navLinksEl && indicatorEl)
        ? initRubberSegment(navLinksEl, indicatorEl)
        : null;

    /* Fallback plain indicator */
    function moveIndicator(link) {
        if (!link || !navLinksEl || !indicatorEl) return;
        const listRect = navLinksEl.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        indicatorEl.style.left  = (linkRect.left - listRect.left) + 'px';
        indicatorEl.style.width = linkRect.width + 'px';
        indicatorEl.classList.add('visible');
    }

    const sectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => {
                    const isActive = link.getAttribute('href') === '#' + entry.target.id;
                    link.classList.toggle('active', isActive);
                    if (isActive) {
                        rubber ? rubber.moveTo(link) : moveIndicator(link);
                    }
                });
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(s => sectionObserver.observe(s));

    /* ── Scroll reveal: GSAP AnimatedContent ───────────── */
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (window.initAnimatedContent) {
        initAnimatedContent({ distance: 28, direction: 'vertical', duration: 0.7, ease: 'power3.out', stagger: 0.06 });
    } else if (prefersReduced) {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    } else {
        const revealObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    }

    /* ── Timeline line draw ────────────────────────────── */
    const timeline = document.querySelector('.timeline');
    if (timeline && !prefersReduced) {
        const timelineObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { timeline.classList.add('drawn'); timelineObserver.disconnect(); }
            });
        }, { threshold: 0.1 });
        timelineObserver.observe(timeline);
    } else if (timeline) {
        timeline.classList.add('drawn');
    }

    /* ── Project filter ────────────────────────────────── */
    const filterBtns  = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card[data-filter-cats]');

    function getFilterFromHash() {
        const hash = window.location.hash;
        if (hash.startsWith('#filter-')) return hash.replace('#filter-', '');
        return 'all';
    }

    function applyFilter(filter) {
        filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
        projectCards.forEach(card => {
            const cats = (card.dataset.filterCats || '').split(' ');
            card.classList.toggle('filtered-out', filter !== 'all' && !cats.includes(filter));
        });
    }

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;
            if (filter === 'all') {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            } else {
                history.replaceState(null, '', '#filter-' + filter);
            }
            applyFilter(filter);
        });
    });

    applyFilter(getFilterFromHash());

    /* ── Modal carousel state ──────────────────────────── */
    let modalImages = [], modalIndex = 0;

    window.openModal = function (src, type = 'image', images = []) {
        const modal    = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImage');
        const modalVid = document.getElementById('modalVideo');
        const modalYT  = document.getElementById('modalYoutube');
        const prevBtn  = document.getElementById('modalPrev');
        const nextBtn  = document.getElementById('modalNext');

        modalImg.style.display = 'none';
        modalVid.style.display = 'none'; modalVid.pause(); modalVid.src = '';
        modalYT.style.display  = 'none'; modalYT.src = '';
        prevBtn.style.display  = 'none';
        nextBtn.style.display  = 'none';
        modalImages = [];

        if (type === 'youtube') {
            modalYT.style.display = 'block';
            modalYT.src = `https://www.youtube.com/embed/${src}?autoplay=1&rel=0&modestbranding=1`;
        } else if (type === 'video') {
            modalVid.style.display = 'block';
            modalVid.src = src; modalVid.play();
        } else {
            modalImg.style.display = 'block';
            modalImg.src = src;
            modalImages = images; modalIndex = images.indexOf(src);
            if (modalIndex === -1) modalIndex = 0;
            const multi = images.length > 1;
            prevBtn.style.display = multi ? 'flex' : 'none';
            nextBtn.style.display = multi ? 'flex' : 'none';
        }

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    window.modalNavigate = function (dir) {
        if (!modalImages.length) return;
        modalIndex = (modalIndex + dir + modalImages.length) % modalImages.length;
        document.getElementById('modalImage').src = modalImages[modalIndex];
    };

    window.closeModal = function () {
        const modal    = document.getElementById('imageModal');
        const modalVid = document.getElementById('modalVideo');
        const modalYT  = document.getElementById('modalYoutube');
        modalVid.pause(); modalVid.src = ''; modalYT.src = '';
        modal.style.display = 'none';
        document.body.style.overflow = '';
        modalImages = [];
    };

    /* ── Copy email ────────────────────────────────────── */
    window.copyEmail = function () {
        const email = 'babalola.t.paul@gmail.com';
        navigator.clipboard.writeText(email).then(() => {
            const btn  = document.getElementById('emailCopyBtn');
            const text = document.getElementById('emailText');
            btn.classList.add('copied');
            text.textContent = 'Copied!';
            setTimeout(() => { btn.classList.remove('copied'); text.textContent = email; }, 2000);
        });
    };

    /* ── Keyboard navigation for modal ────────────────── */
    document.addEventListener('keydown', e => {
        if (document.getElementById('imageModal').style.display !== 'block') return;
        if (e.key === 'ArrowRight') window.modalNavigate(1);
        if (e.key === 'ArrowLeft')  window.modalNavigate(-1);
        if (e.key === 'Escape')     window.closeModal();
    });

    document.getElementById('imageModal').addEventListener('click', e => {
        if (e.target === document.getElementById('imageModal')) window.closeModal();
    });

    document.querySelector('.close').addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') window.closeModal();
    });

    /* ── MorphSlider: replace image carousels ──────────── */
    const morphDestroyers = [];
    document.querySelectorAll('[data-carousel]').forEach(carousel => {
        const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
        if (!slides.length || !window.initMorphSlider) {
            /* Fallback: plain carousel */
            const dots = carousel.querySelectorAll('.dot');
            let current = 0;
            function goTo(index) {
                slides[current].classList.remove('active'); dots[current]?.classList.remove('active');
                current = index;
                slides[current].classList.add('active'); dots[current]?.classList.add('active');
            }
            dots.forEach(dot => dot.addEventListener('click', e => { e.stopPropagation(); goTo(Number(dot.dataset.index)); }));
            const slideSrcs = slides.map(s => s.src);
            slides.forEach(slide => slide.addEventListener('click', e => { e.stopPropagation(); window.openModal(slide.src, 'image', slideSrcs); }));
            setInterval(() => goTo((current + 1) % slides.length), 3000);
            return;
        }

        const items = slides.map(img => ({ image: img.src, caption: img.alt || '' }));
        const slider = initMorphSlider(carousel, items, {
            transition: 'melt',
            intensity: 0.55,
            aberration: 0.35,
            drift: 0.4,
            autoplay: true,
            showIndicators: true,
            showControls: false,
            showCaptions: false,
        });

        if (slider) {
            /* Click to open modal with all images */
            const srcs = items.map(i => i.image);
            carousel.addEventListener('click', () => {
                if (srcs.length) window.openModal(srcs[0], 'image', srcs);
            });
            morphDestroyers.push(slider.destroy.bind(slider));
        }
    });

    /* ── Orb: WebGL hero background ────────────────────── */
    if (window.initOrb) {
        initOrb(document.getElementById('hero-orb'), {
            colors: ['#9c43fe', '#4cc2e9', '#101499'],
            hoverIntensity: 1,
            trail: 1,
            rotateOnHover: true,
            followCursor: true,
        });
    }

    /* ── Magnet: hero CTA buttons ──────────────────────── */
    if (window.initMagnet) {
        document.querySelectorAll('.cta').forEach(btn => {
            initMagnet(btn, { padding: 100, magnetStrength: 2 });
        });
    }

    /* ── GlareHover: experience timeline cards ─────────── */
    if (window.initGlareHover) {
        document.querySelectorAll('.timeline-content').forEach(el => {
            initGlareHover(el, {
                width: '100%',
                height: '100%',
                borderRadius: '14px',
                mode: 'hover',
                variant: 'streak',
                glareColor: '#ffffff',
                glareOpacity: 0.5,
                glareSize: 30,
                softness: 0.6,
                glareAngle: -45,
                blendMode: 'screen',
                rimGlint: true,
                transitionDuration: 650,
            });
        });
    }

    /* ── TargetCursor: project cards ───────────────────── */
    if (window.initTargetCursor) {
        initTargetCursor({
            spinDuration: 2,
            hideDefaultCursor: false,
            parallaxOn: true,
            zone: document.getElementById('projects'),
        });
    }

    /* ── Lanyard: profile image ────────────────────────── */
    const lanyardContainer = document.getElementById('lanyardContainer');
    if (lanyardContainer && window.initLanyard) {
        const lanyard = initLanyard(lanyardContainer, {
            frontImage: 'images/paulbabs.jpg',
            imageFit: 'cover',
            orientation: 'portrait',
            finish: 'glossy',
            cornerRadius: 0.35,
            size: 0.72,
            anchor: 'center',
            strapLength: 0.5,
            strapColor: '#9c43fe',
            metal: 'silver',
            gravity: 1,
            damping: 0.5,
            elasticity: 0.4,
            breeze: 0.3,
            interactive: true,
            intro: true,
        });
        if (!lanyard) lanyardContainer.classList.add('lanyard-fallback');
    } else if (lanyardContainer) {
        lanyardContainer.classList.add('lanyard-fallback');
    }

}); /* end DOMContentLoaded */

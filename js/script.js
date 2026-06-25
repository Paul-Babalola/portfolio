// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// Nav: frosted glass on scroll
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// Nav: highlight active section via scroll-spy
const navLinks = document.querySelectorAll('.nav-links li a');
const sections = document.querySelectorAll('section[id]');

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navLinks.forEach(link => {
                link.classList.toggle(
                    'active',
                    link.getAttribute('href') === '#' + entry.target.id
                );
            });
        }
    });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => observer.observe(s));

// Modal carousel state
let modalImages = [];
let modalIndex  = 0;

// Open the modal (type: 'image' | 'video' | 'youtube', images: optional array for carousel)
function openModal(src, type = 'image', images = []) {
    const modal      = document.getElementById("imageModal");
    const modalImg   = document.getElementById("modalImage");
    const modalVid   = document.getElementById("modalVideo");
    const modalYT    = document.getElementById("modalYoutube");
    const prevBtn    = document.getElementById("modalPrev");
    const nextBtn    = document.getElementById("modalNext");

    // Reset all
    modalImg.style.display = "none";
    modalVid.style.display = "none";  modalVid.pause(); modalVid.src = "";
    modalYT.style.display  = "none";  modalYT.src = "";
    prevBtn.style.display  = "none";
    nextBtn.style.display  = "none";
    modalImages = [];

    if (type === 'youtube') {
        modalYT.style.display = "block";
        modalYT.src = `https://www.youtube.com/embed/${src}?autoplay=1&rel=0&modestbranding=1`;
    } else if (type === 'video') {
        modalVid.style.display = "block";
        modalVid.src = src;
        modalVid.play();
    } else {
        modalImg.style.display = "block";
        modalImg.src = src;
        modalImages = images;
        modalIndex  = images.indexOf(src);
        if (modalIndex === -1) modalIndex = 0;
        const multi = images.length > 1;
        prevBtn.style.display = multi ? "flex" : "none";
        nextBtn.style.display = multi ? "flex" : "none";
    }

    modal.style.display = "block";
}

function modalNavigate(dir) {
    if (!modalImages.length) return;
    modalIndex = (modalIndex + dir + modalImages.length) % modalImages.length;
    document.getElementById("modalImage").src = modalImages[modalIndex];
}

// Close the modal
function closeModal() {
    const modal   = document.getElementById("imageModal");
    const modalVid = document.getElementById("modalVideo");
    const modalYT  = document.getElementById("modalYoutube");
    modalVid.pause(); modalVid.src = "";
    modalYT.src = "";
    modal.style.display = "none";
    modalImages = [];
}

// Copy email to clipboard
function copyEmail() {
    const email = 'babalola.t.paul@gmail.com';
    navigator.clipboard.writeText(email).then(() => {
        const btn  = document.getElementById('emailCopyBtn');
        const text = document.getElementById('emailText');
        btn.classList.add('copied');
        text.textContent = 'Copied!';
        setTimeout(() => {
            btn.classList.remove('copied');
            text.textContent = email;
        }, 2000);
    });
}

// Keyboard navigation
document.addEventListener('keydown', e => {
    if (document.getElementById("imageModal").style.display !== "block") return;
    if (e.key === "ArrowRight") modalNavigate(1);
    if (e.key === "ArrowLeft")  modalNavigate(-1);
    if (e.key === "Escape")     closeModal();
});

// Close modal only when clicking the dark backdrop, not any child element
document.getElementById("imageModal").addEventListener('click', e => {
    if (e.target === document.getElementById("imageModal")) closeModal();
});

// Image carousels
document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots   = carousel.querySelectorAll('.dot');
    let current  = 0;

    function goTo(index) {
        slides[current].classList.remove('active');
        dots[current].classList.remove('active');
        current = index;
        slides[current].classList.add('active');
        dots[current].classList.add('active');
    }

    dots.forEach(dot => dot.addEventListener('click', e => {
        e.stopPropagation();
        goTo(Number(dot.dataset.index));
    }));

    // Click image to open modal with the full slide list for in-modal navigation
    const slideSrcs = Array.from(slides).map(s => s.src);
    slides.forEach(slide => slide.addEventListener('click', e => {
        e.stopPropagation();
        openModal(slide.src, 'image', slideSrcs);
    }));

    // Auto-advance every 3s
    setInterval(() => goTo((current + 1) % slides.length), 3000);
});

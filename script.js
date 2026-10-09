// Ruta al worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Nombre del archivo PDF alojado directamente en el repositorio de Github
const STORY_FILE_NAME = 'Elmundoserompió.pdf';
const STORY_PDF_PATH = './' + encodeURIComponent(STORY_FILE_NAME);

const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const pageInfo = document.getElementById('page-info');
const flowerContainer = document.getElementById('final-flower-container');
const btnRestart = document.getElementById('btn-restart');

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnTTS = document.getElementById('btn-tts');
const btnMusic = document.getElementById('btn-music');
const bgMusic = document.getElementById('bg-music');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');

let pageFlip = null;
let pdfDoc = null;
let extractedTexts = [];
let currentScale = 1.0;
let availableVoices = [];
let isMusicPlaying = false;

// Precargar voces para la lectura
function loadVoices() {
    if ('speechSynthesis' in window) {
        availableVoices = window.speechSynthesis.getVoices();
    }
}
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
}

// Inicializar al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
    loadStoryFromRepo(STORY_PDF_PATH);
    initStarRating();
    initMusicPlayer();
});

// Control de Música Relajante de Fondo
function initMusicPlayer() {
    bgMusic.volume = 0.25; // Volumen suave
    
    btnMusic.addEventListener('click', () => {
        if (isMusicPlaying) {
            bgMusic.pause();
            btnMusic.innerText = '🎵 Música: Off';
            isMusicPlaying = false;
        } else {
            bgMusic.play().then(() => {
                btnMusic.innerText = '🎵 Música: On';
                isMusicPlaying = true;
            }).catch(e => console.log('El navegador bloqueó la reproducción automática.'));
        }
    });

    // Activar música al interactuar la primera vez con la página
    document.body.addEventListener('click', () => {
        if (!isMusicPlaying && bgMusic.paused) {
            bgMusic.play().then(() => {
                btnMusic.innerText = '🎵 Música: On';
                isMusicPlaying = true;
            }).catch(() => {});
        }
    }, { once: true });
}

async function loadStoryFromRepo(pdfUrl) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';
    flowerContainer.style.display = 'none';
    bookContainer.innerHTML = '';
    extractedTexts = [];

    try {
        pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
        const totalPages = pdfDoc.numPages;

        const firstPage = await pdfDoc.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: 1.5 });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 });

            // Renderizado visual
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.appendChild(canvas);
            bookContainer.appendChild(pageDiv);

            // Extracción de texto
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedTexts.push(pageText);
        }

        bookContainer.style.display = 'block';

        pageFlip = new St.PageFlip(bookContainer, {
            width: pageWidth,
            height: pageHeight,
            size: "stretch",
            minWidth: 315,
            maxWidth: pageWidth,
            minHeight: 420,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.8,
            usePortrait: true
        });

        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);

        // Eventos al hojear (sin sonido)
        pageFlip.on('flip', () => {
            updatePageInfo();
            stopSpeech();
            checkFinalPage();
        });

        updatePageInfo();
        loading.style.display = 'none';

    } catch (error) {
        console.error('Error al cargar el cuento desde GitHub:', error);
        loading.innerText = 'Error al cargar "Elmundoserompió.pdf". Verifica que esté subido en la raíz del repositorio.';
    }
}

// Verificar si se alcanzó la página final
function checkFinalPage() {
    if (!pageFlip) return;
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = pageFlip.getPageCount();

    if (current === total) {
        setTimeout(() => {
            bookContainer.style.display = 'none';
            flowerContainer.style.display = 'flex';
        }, 1200);
    }
}

// Botón para reiniciar desde la flor
if (btnRestart) {
    btnRestart.addEventListener('click', () => {
        flowerContainer.style.display = 'none';
        bookContainer.style.display = 'block';
        if (pageFlip) {
            pageFlip.flip(0);
        }
    });
}

// Navegación
btnPrev.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipPrev();
});

btnNext.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipNext();
});

function updatePageInfo() {
    if (!pageFlip) return;
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = pageFlip.getPageCount();
    pageInfo.innerText = `Página ${current} de ${total}`;
}

// Filtro de texto para omitir menciones de licencias o copyright
function filterOutLicenseText(text) {
    if (!text) return '';

    // Palabras y frases asociadas a licencias
    const licenseKeywords = [
        /creative commons/gi,
        /todos los derechos reservados/gi,
        /licencia/gi,
        /copyright/gi,
        /isbn/gi,
        /©/g,
        /http[s]?:\/\/\S+/gi
    ];

    let cleanText = text;
    licenseKeywords.forEach(pattern => {
        cleanText = cleanText.replace(pattern, '');
    });

    return cleanText.trim();
}

// Lectura en Voz Alta (Femenina, sutil y omitiendo licencias)
btnTTS.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) {
        alert('Tu navegador no soporta lectura en voz alta.');
        return;
    }

    if (window.speechSynthesis.speaking) {
        stopSpeech();
        return;
    }

    const currentIndex = pageFlip ? pageFlip.getCurrentPageIndex() : 0;
    const rawText = extractedTexts[currentIndex];
    const textToRead = filterOutLicenseText(rawText);

    if (!textToRead || textToRead.trim() === '') {
        alert('Esta página no contiene texto narrativo para leer.');
        return;
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'es-ES';
    
    // Parámetros para tono suave y pausado
    utterance.rate = 0.85;
    utterance.pitch = 1.1;

    // Buscar voz femenina en español
    if (availableVoices.length === 0) {
        availableVoices = window.speechSynthesis.getVoices();
    }

    const femaleSpanishVoice = availableVoices.find(voice => 
        voice.lang.startsWith('es') && 
        (voice.name.includes('Monica') || 
         voice.name.includes('Paulina') || 
         voice.name.includes('Sabina') || 
         voice.name.includes('Helena') || 
         voice.name.includes('Lucia') || 
         voice.name.toLowerCase().includes('female'))
    ) || availableVoices.find(voice => voice.lang.startsWith('es'));

    if (femaleSpanishVoice) {
        utterance.voice = femaleSpanishVoice;
    }

    utterance.onstart = () => {
        btnTTS.innerText = '⏹️ Detener Lectura';
    };

    utterance.onend = () => {
        btnTTS.innerText = '🔊 Leer en Voz Alta';
    };

    window.speechSynthesis.speak(utterance);
});

function stopSpeech() {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        btnTTS.innerText = '🔊 Leer en Voz Alta';
    }
}

// Zoom
btnZoomIn.addEventListener('click', () => {
    if (currentScale < 1.5) {
        currentScale += 0.1;
        bookContainer.style.transform = `scale(${currentScale})`;
    }
});

btnZoomOut.addEventListener('click', () => {
    if (currentScale > 0.8) {
        currentScale -= 0.1;
        bookContainer.style.transform = `scale(${currentScale})`;
    }
});

// Puntuación 5 estrellas
function initStarRating() {
    const stars = document.querySelectorAll('.star');
    const message = document.getElementById('rating-message');
    let selectedRating = 0;

    stars.forEach(star => {
        star.addEventListener('mouseover', () => {
            const val = parseInt(star.getAttribute('data-value'));
            highlightStars(val);
        });

        star.addEventListener('mouseout', () => {
            highlightStars(selectedRating);
        });

        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-value'));
            highlightStars(selectedRating);
            if (message) {
                message.innerText = `¡Gracias! Puntuaste con ${selectedRating} estrella(s).`;
            }
        });
    });

    function highlightStars(count) {
        stars.forEach(s => {
            const sVal = parseInt(s.getAttribute('data-value'));
            if (sVal <= count) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
    }
}
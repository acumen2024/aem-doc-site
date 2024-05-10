import {
  sampleRUM,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForLCP,
  loadBlocks,
  loadCSS,
} from './aem.js';

import {
  getPlaceholders,
  loadLazy,
  loadDelayed,
  loadTemplate,
  createElement,
  slugify,
  variantsClassesToBEM,
} from './common.js';

import {
  isVideoLink,
  isSoundcloudLink,
  isLowResolutionVideoUrl,
  addVideoShowHandler,
  addSoundcloudShowHandler,
} from './video-helper.js';


const LCP_BLOCKS = []; // add your LCP blocks to the list

function getCTAContainer(ctaLink) {
  return ['strong', 'em'].includes(ctaLink.parentElement.localName)
    ? ctaLink.parentElement.parentElement
    : ctaLink.parentElement;
}

function isCTALinkCheck(ctaLink) {
  const btnContainer = getCTAContainer(ctaLink);
  if (!btnContainer.classList.contains('button-container')) return false;
  const nextSibling = btnContainer?.nextElementSibling;
  const previousSibling = btnContainer?.previousElementSibling;
  const twoPreviousSibling = previousSibling?.previousElementSibling;
  const siblings = [previousSibling, nextSibling, twoPreviousSibling];
  return siblings.some((elem) => elem?.localName === 'h1');
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
 const firstSection = main.querySelector('div');
  if (!firstSection) return;
  const firstElement = firstSection.firstElementChild;
  if (firstElement.tagName === 'DIV' && firstElement.classList.length && !firstElement.classList.contains('hero')) return;

  const h1 = firstSection.querySelector('h1');
  const picture = firstSection.querySelector('picture');
  let ctaLink = firstSection.querySelector('a');
  let video = null;

  // eslint-disable-next-line no-use-before-define
  if (ctaLink && isLowResolutionVideoUrl(ctaLink.getAttribute('href'))) {
    const videoTemp = `
      <video muted loop class="hero-video">
        <source src="${ctaLink.getAttribute('href')}" type="video/mp4"></source>
      </video>
    `;

    const videoWrapper = document.createElement('div');
    videoWrapper.innerHTML = videoTemp;
    video = videoWrapper.querySelector('video');
    ctaLink.parentElement.remove();
    ctaLink = firstSection.querySelector('a');

    // adding video with delay to not affect page loading time
    setTimeout(() => {
      picture.replaceWith(video);
      video.play();
    }, 3000);
  }

  // check if the previous element or the previous of that is an h1
  const isCTALink = ctaLink && isCTALinkCheck(ctaLink);
  if (isCTALink) ctaLink.classList.add('cta');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    const headings = createElement('div', { classes: 'hero-headings' });
    const elems = [picture, headings];
    if (h1.nextElementSibling && (h1.nextElementSibling.matches('h2,h3,h4')
      // also consider a <p> without any children as sub heading except BR
      || (h1.nextElementSibling.matches('p') && ![...h1.nextElementSibling.children].filter((el) => el.tagName !== 'BR').length))) {
      const h4 = document.createElement('h4');
      h4.innerHTML = h1.nextElementSibling.innerHTML;
      h1.nextElementSibling.remove();
      headings.appendChild(h4);
    }
    headings.appendChild(h1);
    if (isCTALink) headings.appendChild(getCTAContainer(ctaLink));
    const section = document.createElement('div');
    const newHeroBlock = buildBlock('hero', { elems });
    newHeroBlock.classList.add(...firstElement.classList);
    section.append(newHeroBlock);
    // remove the empty pre-section to avoid decorate it as empty section
    const containerChildren = firstSection.children;
    const wrapperChildren = containerChildren[0].children;
    if (containerChildren.length <= 1 && wrapperChildren.length === 0) firstSection.remove();
    else if (wrapperChildren.length === 0) containerChildren[0].remove();

    if (video) {
      section.querySelector('.hero')?.classList.add('hero-with-video');
    }

    // after all are settled, the new section can be added
    main.prepend(section);
  }
}


/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await waitForLCP(LCP_BLOCKS);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();

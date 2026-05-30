/**
 * mucous.js
 * A sticky highlight that follows your mouse like glue.
 *
 * HTML:  <ul data-mucous> ... </ul>
 * JS:    import Mucous from './mucous.js'
 *        const menu = Mucous('#menu', { speed: 120 })
 *        menu.moveTo(element)
 *        menu.destroy()
 */

const MUCOUS_DF = {
    itemSelector: '.menu-item',
    highlightClass: 'mucous-highlight',
    hoveredClass: 'hovered',
    speed: 180,
    easing: 'cubic-bezier(.4,0,.2,1)',
};

/**
 * @param {string|Element} selector
 * @param {Partial<typeof MUCOUS_DF>} [options]
 * @returns {{ moveTo: (item: Element) => void, destroy: () => void }}
 */
const Mucous = (selector, options = {}) => {
    const o = { ...MUCOUS_DF, ...options };
    const menu = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!menu) throw new Error(`[Mucous] not found: ${selector}`);

    // floating bar that slides to follow the mouse
    const hl = document.createElement('div');
    hl.className = o.highlightClass;
    hl.style.cssText = `
    position: absolute; left: 6px; right: 6px;
    border-radius: 5px; pointer-events: none; opacity: 0;
    transition: top ${o.speed}ms ${o.easing}, height ${o.speed}ms ${o.easing}, opacity 120ms ease;
  `;

    if (getComputedStyle(menu).position === 'static') menu.style.position = 'relative';
    menu.style.overflow = 'hidden';
    menu.prepend(hl);

    const items = [...menu.querySelectorAll(o.itemSelector)];

    // on hover — slide highlight over the item
    items.forEach(item => {
        item.addEventListener('mouseenter', () => {
            hl.style.top = `${item.offsetTop}px`;
            hl.style.height = `${item.offsetHeight}px`;
            hl.style.opacity = '1';
            items.forEach(i => i.classList.toggle(o.hoveredClass, i === item));
        });
    });

    // on leave — hide highlight
    menu.addEventListener('mouseleave', () => {
        hl.style.opacity = '0';
        items.forEach(i => i.classList.remove(o.hoveredClass));
    });

    return {
        /** Programmatically move highlight to an item without hovering */
        moveTo: (item) => {
            hl.style.top = `${item.offsetTop}px`;
            hl.style.height = `${item.offsetHeight}px`;
            hl.style.opacity = '1';
            items.forEach(i => i.classList.toggle(o.hoveredClass, i === item));
        },
        /** Remove highlight and restore menu to original state */
        destroy: () => {
            hl.remove();
            items.forEach(i => i.classList.remove(o.hoveredClass));
            delete menu._mucous;
        },
    };
};

export default Mucous;

// auto-init all elements with data-mucous attribute
const scan = (root = document) => {
    root.querySelectorAll('[data-mucous]').forEach(menu => {
        if (menu._mucous) return;
        menu._mucous = Mucous(menu, {
            speed: parseInt(menu.dataset.mucousSpeed) || MUCOUS_DF.speed,
            easing: menu.dataset.mucousEasing || MUCOUS_DF.easing,
            itemSelector: menu.dataset.mucousItem || MUCOUS_DF.itemSelector,
        });
    });
};

if (typeof document !== 'undefined') {
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', () => scan())
        : scan();
}
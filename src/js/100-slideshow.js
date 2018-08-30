(function (global, d) {
    'use strict';

    const CYCLE = true;
    const slides = d.querySelectorAll('.slides > li');
    let current = 1;
    let currentStep = 0;
    let currentSteps = [];
    const minIndex = 0;
    const maxIndex = slides.length - 1;
    let interactive = false;
    let body;

    // Reverse z-index stack so that first slide is on top
    for (let s = 0; s < slides.length; ++s) {
        slides[s].style.zIndex = maxIndex - s;
        slides[s].setAttribute('data-slide-index', s);
        if (s > 0) {
            slides[s].style.display = 'none';
        }
    }

    /**
     * Call a list of user defined commands
     *
     * @param {Array} commands User defined commands
     * @param {Element} prev Previous slide
     * @param {Element} next Next slide
     * @param {Function} callback Callback
     */
    function call(commands, prev, next, callback) {
        (function run() {
            if (commands.length === 0) {
                return callback(prev, next);
            }
            const action = global.SlideshowAction[commands.shift()];
            if (action) {
                action(prev, next, next);
            } else {
                run();
            }
        }());
    }

    /**
     * Leave a slide
     *
     * @param {Element} prev Previous slide
     * @param {Element} next Next slide
     * @param {Function} callback Callback after transition
     */
    function leave(prev, next, callback) {
        if (!prev) {
            if (callback) {
                callback();
            }
            return;
        }
        prev.classList.remove('active');
        step(prev, 0);
        const commands = prev.getAttribute('data-onleave');
        call(commands ? commands.split(',') : [], prev, next, callback);
    }

    /**
     * Enter a slide
     *
     * @param {Element} prev Previous slide
     * @param {Element} next Next slide
     * @param {Function} callback Callback after transition
     */
    function enter(prev, next, callback) {
        let list = 0;
        if (!next) {
            if (callback) {
                callback();
            }
            return;
        }
        const steps = next.getAttribute('data-steps');
        if (steps && steps.length) {
            currentSteps = steps.split(' ');
        } else if (interactive && (list = next.querySelectorAll('ul:not(.static) > li').length)) {
            currentSteps = [];
            for (let s = 0; s <= list; ++s) {
                currentSteps.push(`step-${s}`);
            }
        } else {
            currentSteps = [''];
        }
        step(next, 0);
        const commands = next.getAttribute('data-onenter');
        call(commands ? commands.split(',') : [], prev, next, shuffle);
        setTimeout(() => {
            next.classList.add('active');
        }, 10);
    }

    /**
     * Alter the slide z-index order
     *
     * @param {Element} prev Previous slide
     * @param {Element} next Next slide
     */
    function shuffle(prev, next) {
        for (let s = 0; s < slides.length; ++s) {
            slides[s].style.zIndex = minIndex;
        }
        if (prev) {
            // prev.stop(); // Stop any animation
            prev.style.zIndex = maxIndex - 1;
        }
        // next.stop();  // Stop any animation
        next.style.zIndex = maxIndex;
        next.style.display = '';
    }

    /**
     * Transition between two slides
     *
     * @param {Number} prevIndex Index of previous slide
     * @param {Number} nextIndex Index of next slide
     */
    function transition(prevIndex, nextIndex) {
        global.location.hash = `#${current}`;
        leave((prevIndex === -1) ? null : slides[prevIndex], slides[nextIndex], enter);
    }

    /**
     * Return the previous slide index
     *
     * @param {Number} index Current slide index
     * @param {Boolean} cycle Cycle slides
     * @returns {Number} Previous slide index
     */
    function prev(index, cycle) {
        if (currentStep > 0) {
            step(slides[index], currentStep - 1);
            return index;
        }
        const newIndex = index - 1;
        return (newIndex >= minIndex) ? newIndex : (cycle ? maxIndex : minIndex);
    }

    /**
     * Return the next slide index
     *
     * @param {Number} index Current slide index
     * @param {Boolean} cycle Cycle slides
     * @returns {Number} Next slide index
     */
    function next(index, cycle) {
        if (currentStep < currentSteps.length - 1) {
            step(slides[index], currentStep + 1);
            return index;
        }
        let newIndex = index + 1;
        newIndex = (newIndex <= maxIndex) ? newIndex : (cycle ? minIndex : maxIndex);
        return newIndex;
    }

    /**
     * Swich the current slide index
     *
     * @param {Element} slide Current slide
     * @param {Number} step Future slide index
     */
    function step(slide, step) {
        if (currentSteps[currentStep]) {
            slide.classList.remove(currentSteps[currentStep]);
        }
        currentStep = step;
        if (currentSteps[currentStep]) {
            slide.classList.add(currentSteps[currentStep]);
        }
    }

    /**
     * Toggle the cursor
     */
    function toggleMouse() {
        const cursor = body.style.cursor;
        body.style.cursor = (cursor === 'none') ? 'crosshair' : 'none';
    }

    /**
     * Toggle the interactive state
     */
    function toggleInteractive() {
        interactive = !interactive;
    }

    /**
     * Keydown handler
     *
     * @param {Event} e Event
     */
    function keyDown(e) {
        const old = current;
        switch (e.keyCode) {
        case 33: // [Page up]
        case 37: // ←
        case 38: // ↑
            current = prev(old, CYCLE);
            break;
        case 32: // [space]
        case 34: // [Page down]
        case 39: // →
        case 40: // ↓
        case 13: // ←┘
            current = next(old, CYCLE);
            break;
        case 27: // [esc]
            return;
        case 17: // [ctrl]
            toggleMouse();
            return;
        case 16: // [shift]
            toggleInteractive();
            return;
        default:
            return;
        }
        if (current !== old) {
            transition(old, current);
        }
    }

    // One-time intialization of current slide from the location hash
    if (window.location.hash) {
        current = parseInt(location.hash.replace('#', '') || 0, 10) || current;
    }

    // Prepare the touch event states
    const touches = {
        touchstart: { x: -1, y: -1 },
        touchmove: { x: -1, y: -1 },
        touchend: false,
    };

    /**
     * Touch handler
     *
     * @param {Event} e Event
     */
    const touchHandler = function (e) {
        let touch;
        if (typeof e !== 'undefined') {
            e.preventDefault();
            if (typeof e.touches !== 'undefined') {
                touch = e.touches[0];
                switch (e.type) {
                case 'touchstart':
                case 'touchmove':
                    touches[e.type].x = touch.pageX;
                    touches[e.type].y = touch.pageY;
                    break;
                case 'touchend':
                    touches[e.type] = true;
                    if (touches.touchstart.x > -1 && touches.touchmove.x > -1) {
                        const old = current;
                        current = (touches.touchstart.x < touches.touchmove.x) ? prev(old, CYCLE) : next(old, CYCLE);
                        if (current !== old) {
                            transition(old, current);
                        }
                    }
                default:
                    break;
                }
            }
        }
    };

    // Add document-level handlers
    d.addEventListener('touchstart', touchHandler, false);
    d.addEventListener('touchmove', touchHandler, false);
    d.addEventListener('touchend', touchHandler, false);
    d.addEventListener('keydown', keyDown, false);
    d.addEventListener('DOMContentLoaded', () => {
        body = document.querySelector('body');
        body.style.cursor = 'none';
        transition(0, current);
    });
}(window, document));

(function (global, d) {
    'use strict';

    global.SlideshowAction = {};
    var CYCLE = true;
    var slides = d.querySelectorAll('.slides > li');
    var current = 0;
    var currentStep = 0;
    var currentSteps = [];
    var minIndex = 0;
    var maxIndex = slides.length - 1;
    var interactive = false;
    var miniatures = false;
    var body;
    var listTypes = ['ul', 'ol', 'dl'];

    /**
     * Test whether an element is nested inside a list
     *
     * @param {Element} el Element
     * @param {Element} root Root element
     * @returns {boolean} Is nested inside a list
     */
    function hasListAncestor(el, root) {
        while (el.parentNode && (el.parentNode !== root)) {
            if (listTypes.indexOf(el.parentNode.tagName.toLowerCase()) >= 0) {
                return true;
            }
            el = el.parentNode;
        }
        return false;
    }

    /**
     * Prepare an interactive element
     *
     * @param {Element} interactive Interactive element
     * @param {Number} offset Interactives offset
     * @returns {number} Number of iteractive items
     */
    function prepareInteractive(interactive, offset) {
        var isDefinitionList = interactive.tagName.toLowerCase() === 'dl';
        var interactives = 0;
        for (var c = 0, child; c < interactive.childNodes.length; ++c) {
            child = interactive.childNodes[c];
            if ((child.nodeName.toLowerCase() === (isDefinitionList ? 'dt' : 'li')) && !child.classList.contains('static')) {
                var interactiveClass = 'interactive-' + (offset + interactives++);
                child.classList.add('interactive');
                child.classList.add(interactiveClass);
                if (isDefinitionList) {
                    while (child.nextSibling) {
                        if (child.nextSibling.nodeType === 1) {
                            if (child.nextSibling.tagName.toLowerCase() !== 'dd') {
                                break;
                            }
                            child.nextSibling.classList.add('interactive');
                            child.nextSibling.classList.add(interactiveClass);
                        }
                        child = child.nextSibling;
                    }
                }
            }
        }
        return interactives;
    }

    // Reverse z-index stack so that first slide is on top
    for (var s = 0; s < slides.length; ++s) {
        slides[s].style.zIndex = maxIndex - s;
        slides[s].setAttribute('data-slide-index', s);
        if (s > 0) {
            slides[s].style.display = 'none';
            slides[s].setAttribute('aria-hidden', 'true');
        }
        var interactives = 0;
        var lists = slides[s].querySelectorAll('ul, dl');
        for (var l = 0; l < lists.length; ++l) {
            if (lists[l].classList.contains('static') || hasListAncestor(lists[l], slides[s])) {
                continue;
            }
            interactives += prepareInteractive(lists[l], interactives);
        }
        if (interactives) {
            slides[s].classList.add('has-interactives');
            slides[s].setAttribute('data-interactives', interactives);
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
            var cmd = commands.shift();
            if (cmd.length && (cmd in global.SlideshowAction)) {
                var action = global.SlideshowAction[cmd];
                if (action && ({}.toString.call(action) === '[object Function]')) {
                    action(prev, next);
                }
            }
            return run();
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
        prev.setAttribute('aria-hidden', 'true');
        step(prev, 0);
        var commands = prev.getAttribute('data-onleave');
        commands = commands ? commands.split(' ') : [];
        call(commands.filter(function (cmd) {
            return cmd.length > 0
        }), prev, next, callback);
    }

    /**
     * Enter a slide
     *
     * @param {Element} prev Previous slide
     * @param {Element} next Next slide
     * @param {Function} callback Callback after transition
     */
    function enter(prev, next, callback) {
        var list = 0;
        if (!next) {
            if (callback) {
                callback();
            }
            return;
        }
        var steps = next.getAttribute('data-steps');
        if (steps && steps.length) {
            currentSteps = steps.split(' ');
        } else if (interactive && (list = parseInt(next.getAttribute('data-interactives') || '0', 10))) {
            currentSteps = [];
            for (var s = 0; s <= list; ++s) {
                currentSteps.push('step-' + s);
            }
        } else {
            currentSteps = [''];
        }
        step(next, 0);
        var commands = next.getAttribute('data-onenter');
        commands = commands ? commands.split(' ') : [];
        call(commands.filter(function (cmd) {
            return cmd.length > 0
        }), prev, next, shuffle);
        setTimeout(function () {
            next.classList.add('active');
            next.removeAttribute('aria-hidden');
        }, 10);
    }

    /**
     * Alter the slide z-index order
     *
     * @param {Element} prev Previous slide
     * @param {Element} next Next slide
     */
    function shuffle(prev, next) {
        for (var s = 0; s < slides.length; ++s) {
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
        global.location.hash = '#' + current;
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
        var newIndex = index - 1;
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
        var newIndex = index + 1;
        newIndex = (newIndex <= maxIndex) ? newIndex : (cycle ? minIndex : maxIndex);
        return newIndex;
    }

    /**
     * Switch the current slide index
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
        var cursor = body.style.cursor;
        body.style.cursor = (cursor === 'none') ? 'crosshair' : 'none';
    }

    /**
     * Toggle the interactive state
     */
    function toggleInteractive() {
        interactive = !interactive;
        d.documentElement.classList[interactive ? 'add' : 'remove']('is-interactive');
        if (currentSteps.length && currentSteps[0].length) {
            slides[current].classList.remove(currentSteps[currentStep]);
        }
        currentStep = 0;
        currentSteps = [''];
        transition(current, current);
    }

    /**
     * Toggle the miniature mode
     */
    function toggleMiniatures() {
        var s;
        if (miniatures) {
            for (s = 0; s < slides.length; ++s) {
                slides[s].onclick = null;
            }
            document.documentElement.classList.remove('miniatures');
            if (interactive) {
                document.documentElement.classList.add('is-interactive');
            }
        } else {
            for (s = 0; s < slides.length; ++s) {
                slides[s].onclick = (function (n) {
                    return function () {
                        toggleMiniatures();
                        transition(current, n);
                    }
                })(s);
            }
            document.documentElement.classList.remove('is-interactive');
            document.documentElement.classList.add('miniatures');
        }
        miniatures = !miniatures;
    }

    /**
     * Keydown handler
     *
     * @param {Event} e Event
     */
    function keyDown(e) {
        var old = current;
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
                toggleMiniatures();
                return;
            case 67: // [ctrl]
                toggleMouse();
                return;
            case 73: // [shift]
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
        current = parseInt(location.hash.substr(1) || 0, 10) || current;
    }

    // Prepare the touch event states
    var touches = {
        touchstart: { x: -1, y: -1 },
        touchmove: { x: -1, y: -1 },
        touchend: false,
    };

    /**
     * Touch handler
     *
     * @param {Event} e Event
     */
    var touchHandler = function (e) {
        var touch;
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
                            var old = current;
                            current = (touches.touchstart.x < touches.touchmove.x) ? prev(old, CYCLE) : next(old, CYCLE);
                            if (current !== old) {
                                transition(old, current);
                            }
                        }
                }
            }
        }
    };

    // Add document-level handlers
    d.addEventListener('touchstart', touchHandler, false);
    d.addEventListener('touchmove', touchHandler, false);
    d.addEventListener('touchend', touchHandler, false);
    d.addEventListener('keydown', keyDown, false);
    d.addEventListener('DOMContentLoaded', function () {
        body = document.querySelector('body');
        body.style.cursor = 'none';
        transition(0, current);
    });
}(window, document));
